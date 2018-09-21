import { action, observable, computed } from "mobx";
import { applyPatch, resolvePath } from "mobx-state-tree";
import { FormDefinition, RepeatingForm } from "./form";
import { FormState } from "./state";
import { Accessor } from "./accessor";
import { RepeatingFormIndexedAccessor } from "./repeating-form-indexed-accessor";
import { FormAccessor } from "./form-accessor";

export class RepeatingFormAccessor<M, D extends FormDefinition<M>> {
  name: string;

  @observable
  _error: string | undefined;

  @observable
  repeatingFormIndexedAccessors: Map<
    number,
    RepeatingFormIndexedAccessor<any, any>
  > = observable.map();

  constructor(
    public state: FormState<any, any>,
    public repeatingForm: RepeatingForm<M, D>,
    public parent: FormAccessor<any, any>,
    name: string
  ) {
    this.name = name;
  }

  clear() {
    // no op
  }

  @computed
  get path(): string {
    return this.parent.path + "/" + this.name;
  }

  @action
  setError(error: string) {
    this._error = error;
  }

  @action
  clearError() {
    this._error = undefined;
  }

  async validate(): Promise<boolean> {
    const promises: Promise<any>[] = [];
    for (const accessor of this.accessors) {
      promises.push(accessor.validate());
    }
    const values = await Promise.all(promises);
    return values.every(value => value);
  }

  @computed
  get addMode(): boolean {
    return this.parent.addMode;
  }

  @computed
  get isValid(): boolean {
    return this.accessors.every(accessor => accessor.isValid);
  }

  initialize() {
    const entries = this.state.getValue(this.path);
    let i = 0;
    entries.forEach(() => {
      this.createFormIndexedAccessor(i);
      i++;
    });
  }

  createFormIndexedAccessor(index: number) {
    const result = new RepeatingFormIndexedAccessor(
      this.state,
      this.repeatingForm.definition,
      this,
      index
    );
    this.repeatingFormIndexedAccessors.set(index, result);
    result.initialize();
  }

  index(index: number): RepeatingFormIndexedAccessor<M, D> {
    const accessor = this.repeatingFormIndexedAccessors.get(index);
    if (accessor == null) {
      throw new Error(`${index} is not a RepeatingFormIndexedAccessor`);
    }
    return accessor;
  }

  @computed
  get disabled(): boolean {
    return this.state.isRepeatingFormDisabledFunc(this);
  }

  @computed
  get accessors(): RepeatingFormIndexedAccessor<M, D>[] {
    const result = [];
    for (let index = 0; index < this.length; index++) {
      result.push(this.index(index));
    }
    return result;
  }

  @computed
  get flatAccessors(): Accessor[] {
    const result: Accessor[] = [];
    this.accessors.forEach(accessor => {
      result.push(...accessor.flatAccessors);
    });
    return result;
  }

  accessBySteps(steps: string[]): Accessor | undefined {
    const [first, ...rest] = steps;
    const nr = parseInt(first, 10);
    if (isNaN(nr)) {
      throw new Error("Expected index of repeating form");
    }
    const accessor = this.index(nr);
    return accessor.accessBySteps(rest);
  }

  @computed
  get error(): string | undefined {
    return this._error;
  }

  insert(index: number, node: any) {
    const path = this.path + "/" + index;
    applyPatch(this.state.node, [{ op: "add", path, value: node }]);
  }

  push(node: any) {
    const a = resolvePath(this.state.node, this.path) as any[];
    const path = this.path + "/" + a.length;
    applyPatch(this.state.node, [{ op: "add", path, value: node }]);
  }

  remove(node: any) {
    const a = resolvePath(this.state.node, this.path) as any[];
    const index = a.indexOf(node);
    if (index === -1) {
      throw new Error("Cannot find node to remove.");
    }
    applyPatch(this.state.node, [
      { op: "remove", path: this.path + "/" + index }
    ]);
  }

  removeIndex(index: number) {
    const accessors = this.repeatingFormIndexedAccessors;
    const isRemoved = accessors.delete(index);
    if (!isRemoved) {
      return;
    }
    const toDelete: number[] = [];
    const toInsert: RepeatingFormIndexedAccessor<any, any>[] = [];

    accessors.forEach((accessor, i) => {
      if (i <= index) {
        return;
      }
      accessor.setIndex(i - 1);
      toDelete.push(i);
      toInsert.push(accessor);
    });
    this.executeRenumber(toDelete, toInsert);
  }

  addIndex(index: number) {
    const accessors = this.repeatingFormIndexedAccessors;

    const toDelete: number[] = [];
    const toInsert: RepeatingFormIndexedAccessor<any, any>[] = [];
    accessors.forEach((accessor, i) => {
      if (i < index) {
        return;
      }
      accessor.setIndex(i + 1);
      toDelete.push(i);
      toInsert.push(accessor);
    });
    this.executeRenumber(toDelete, toInsert);
    this.createFormIndexedAccessor(index);
  }

  private executeRenumber(
    toDelete: number[],
    toInsert: RepeatingFormIndexedAccessor<any, any>[]
  ) {
    const accessors = this.repeatingFormIndexedAccessors;

    // first remove all accessors that are renumbered
    toDelete.forEach(index => {
      accessors.delete(index);
    });
    // insert renumbered accessors all at once afterwards
    toInsert.forEach(accessor => {
      accessors.set(accessor.index, accessor);
    });
  }

  get length(): number {
    const a = resolvePath(this.state.node, this.path) as any[];
    return a.length;
  }
}
