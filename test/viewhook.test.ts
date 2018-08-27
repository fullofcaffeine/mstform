import { configure } from "mobx";
import { types } from "mobx-state-tree";
import {
  converters,
  controlled,
  Form,
  Field,
  setupValidationProps,
  ValidationProps,
  antd
} from "../src";

configure({ enforceActions: true });

test("antd validationProps", async () => {
  const M = types.model("M", {
    foo: types.number
  });

  const form = new Form(M, {
    foo: new Field(converters.number, { controlled: controlled.value })
  });

  const o = M.create({ foo: 1 });

  setupValidationProps(antd.validationProps);

  const state = form.state(o);
  const field = state.field("foo");

  expect(field.validationProps).toEqual({ validateStatus: "" });
  await field.setRaw("wrong");
  expect(field.validationProps).toEqual({
    help: "Could not convert",
    validateStatus: "error"
  });
});

test("custom validationProps", async () => {
  const M = types.model("M", {
    foo: types.number
  });

  const form = new Form(M, {
    foo: new Field(converters.number, { controlled: controlled.value })
  });

  const o = M.create({ foo: 1 });

  const myValidationProps: ValidationProps = accessor => {
    return { error: accessor.error };
  };
  setupValidationProps(myValidationProps);

  const state = form.state(o);
  const field = state.field("foo");

  expect(field.validationProps).toEqual({});
  await field.setRaw("wrong");
  expect(field.validationProps).toEqual({
    error: "Could not convert"
  });
});