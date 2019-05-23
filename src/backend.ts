import { applyPatch, IAnyModelType, Instance } from "mobx-state-tree";
import { ChangeTracker, DebounceOptions } from "./changeTracker";
import { ValidationEntries, Message } from "./validationMessages";

type Update = {
  path: string;
  value?: any;
  inclusion?: any;
  model_key?: string;
};

type ValidationInfo = {
  id: string;
  messages: Message[];
};

export type ProcessResult = {
  updates: Update[];
  errorValidations: ValidationInfo[];
  warningValidations: ValidationInfo[];
};

export interface SaveFunc<M> {
  (node: Instance<M>): Promise<Partial<ProcessResult> | undefined | null>;
}

export interface Process<M> {
  (node: Instance<M>, path: string): Promise<ProcessResult>;
}

export interface Revalidate<M> {
  (node: Instance<M>): Promise<Partial<ProcessResult>>;
}

export interface ApplyUpdate {
  (node: Instance<IAnyModelType>, update: any): void;
}

function defaultApplyUpdate(node: Instance<IAnyModelType>, update: any): void {
  applyPatch(node, [{ op: "replace", path: update.path, value: update.value }]);
}

export type ProcessorOptions = { applyUpdate?: ApplyUpdate } & Partial<
  DebounceOptions
>;

export class Backend<M extends IAnyModelType> {
  errorValidations: ValidationEntries;
  warningValidations: ValidationEntries;
  changeTracker: ChangeTracker;
  applyUpdate: ApplyUpdate;

  constructor(
    public node: Instance<M>,
    public save?: SaveFunc<M>,
    public process?: Process<M>,
    public revalidate?: Revalidate<M>,
    { debounce, delay, applyUpdate = defaultApplyUpdate }: ProcessorOptions = {}
  ) {
    this.node = node;
    this.errorValidations = new ValidationEntries();
    this.warningValidations = new ValidationEntries();
    this.changeTracker = new ChangeTracker(
      (path: string) => this.realProcess(path),
      { debounce, delay }
    );
    this.applyUpdate = applyUpdate;
  }

  run(path: string) {
    this.changeTracker.change(path);
  }

  runProcessResult(processResult: ProcessResult) {
    const { updates, errorValidations, warningValidations } = processResult;
    updates.forEach(update => {
      // anything that has changed by the user in the mean time shouldn't
      // be updated, as the user input takes precedence
      if (this.changeTracker.hasChanged(update.path)) {
        return;
      }
      this.applyUpdate(this.node, update);
    });
    this.errorValidations.update(errorValidations);
    this.warningValidations.update(warningValidations);
  }

  async realSave(): Promise<boolean> {
    if (this.save == null) {
      throw new Error("Cannot save if save function is not configured");
    }
    const processResult = await this.save(this.node);

    if (processResult == null) {
      this.errorValidations.clear();
      this.warningValidations.clear();
      return true;
    }
    const completeProcessResult: ProcessResult = {
      updates: [],
      errorValidations: [],
      warningValidations: [],
      ...processResult
    };
    this.runProcessResult(completeProcessResult);
    return false;
  }

  async realRevalidate() {
    if (this.revalidate == null) {
      throw new Error(
        "Cannot revalidate if revalidate function is not configured"
      );
    }
    const processResult = await this.revalidate(this.node);

    const completeProcessResult: ProcessResult = {
      updates: [],
      errorValidations: [],
      warningValidations: [],
      ...processResult
    };
    this.runProcessResult(completeProcessResult);
  }

  async realProcess(path: string) {
    if (this.process == null) {
      return;
    }
    let processResult;
    try {
      processResult = await this.process(this.node, path);
    } catch (e) {
      console.error("Unexpected error during process:", e);
      return;
    }
    this.runProcessResult(processResult);
  }

  isFinished() {
    return this.changeTracker.isFinished();
  }

  getError(path: string): string | undefined {
    return this.errorValidations.getMessage(path);
  }
  getWarning(path: string): string | undefined {
    return this.warningValidations.getMessage(path);
  }
}
