import { observable, computed } from "mobx";
import { applyPatch } from "mobx-state-tree";
import { FormDefinition, RepeatingForm, GroupDefinition } from "./form";
import { FormState } from "./state";
import { Accessor } from "./accessor";
import { RepeatingFormIndexedAccessor } from "./repeating-form-indexed-accessor";
import { FormAccessor } from "./form-accessor";
import { ValidateOptions } from "./validate-options";
import { pathToFieldref } from "./utils";

export class RepeatingFormAccessor<
  D extends FormDefinition<any>,
  G extends GroupDefinition<D>
> {
  name: string;

  @observable
  repeatingFormIndexedAccessors: Map<number, any> = observable.map();

  constructor(
    public state: FormState<any, any, any>,
    public repeatingForm: RepeatingForm<D, G>,
    public parent: FormAccessor<any, any>,
    name: string
  ) {
    this.name = name;
  }

  dispose() {
    // no op
  }

  clear() {
    // no op
  }

  @computed
  get path(): string {
    return this.parent.path + "/" + this.name;
  }

  @computed
  get fieldref(): string {
    return pathToFieldref(this.path);
  }

  @computed
  get value(): any {
    return this.state.getValue(this.path);
  }

  @computed
  get context(): any {
    return this.state.context;
  }

  validate(options?: ValidateOptions): boolean {
    const values = this.accessors.map(accessor => accessor.validate(options));
    // appending possible error on the repeatingform itself
    const ignoreGetError = options != null ? options.ignoreGetError : false;
    if (!ignoreGetError) {
      values.push(this.errorValue === undefined);
    }
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
      this.repeatingForm.groupDefinition,
      this,
      index
    );
    this.repeatingFormIndexedAccessors.set(index, result);
    result.initialize();
  }

  index(index: number): RepeatingFormIndexedAccessor<D, G> {
    const accessor = this.repeatingFormIndexedAccessors.get(index);
    if (accessor == null) {
      throw new Error(`${index} is not a RepeatingFormIndexedAccessor`);
    }
    return accessor;
  }

  @computed
  get disabled(): boolean {
    return this.parent.disabled ? true : this.state.isDisabledFunc(this);
  }

  @computed
  get hidden(): boolean {
    return this.parent.hidden ? true : this.state.isHiddenFunc(this);
  }

  @computed
  get readOnly(): boolean {
    return this.parent.readOnly ? true : this.state.isReadOnlyFunc(this);
  }

  @computed
  get inputAllowed(): boolean {
    return !this.disabled && !this.hidden && !this.readOnly;
  }

  @computed
  get accessors(): RepeatingFormIndexedAccessor<D, G>[] {
    // we get the entries in this map, in order of index
    const length = Array.from(this.repeatingFormIndexedAccessors.values())
      .length;
    const result = [];
    for (let i = 0; i < length; i++) {
      result.push(this.repeatingFormIndexedAccessors.get(i));
    }
    return result;
  }

  @computed
  get flatAccessors(): Accessor[] {
    const result: Accessor[] = [];
    this.accessors.forEach(accessor => {
      result.push(...accessor.flatAccessors);
      result.push(accessor);
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

  insert(index: number, node: any) {
    const path = this.path + "/" + index;
    applyPatch(this.state.node, [{ op: "add", path, value: node }]);
    this.index(index).setAddMode();
  }

  push(node: any) {
    const a = this.value;
    const index = a.length;
    const path = this.path + "/" + index;
    applyPatch(this.state.node, [{ op: "add", path, value: node }]);
    this.index(index).setAddMode();
  }

  remove(node: any) {
    const a = this.value;
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

  @computed
  get length(): number {
    return this.value.length;
  }

  @computed
  get errorValue(): string | undefined {
    return this.state.getErrorFunc(this);
  }

  @computed
  get error(): string | undefined {
    return this.errorValue;
  }

  @computed
  get warningValue(): string | undefined {
    return this.state.getWarningFunc(this);
  }

  @computed
  get warning(): string | undefined {
    return this.warningValue;
  }
}
