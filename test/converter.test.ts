import { configure } from "mobx";
import { types } from "mobx-state-tree";
import { Field, Form, converters, FieldAccessor } from "../src";
import {
  CONVERSION_ERROR,
  ConversionValue,
  Converter,
  ConvertError
} from "../src/converter";

configure({ enforceActions: "observed" });

const options = {
  // a BIG lie. but we don't really have an accessor in these
  // tests and it's safe to leave it null, even though in
  // the integrated code accessor always *does* exist
  accessor: (null as unknown) as FieldAccessor<any, any>
};

test("simple converter", async () => {
  const converter = new Converter<string, string>({
    emptyRaw: "",
    emptyValue: "",
    convert: raw => raw,
    render: value => value
  });

  const result = await converter.convert("foo", options);
  expect(result).toBeInstanceOf(ConversionValue);
  expect((result as ConversionValue<string>).value).toEqual("foo");

  // the string "ConversionError" is a valid text to convert
  const result2 = await converter.convert("ConversionError", options);
  expect(result2).toBeInstanceOf(ConversionValue);
  expect((result2 as ConversionValue<string>).value).toEqual("ConversionError");
});

test("converter emptyImpossible and emptyValue", async () => {
  expect(
    () =>
      new Converter<string, string>({
        emptyRaw: "",
        emptyValue: "",
        emptyImpossible: true,
        convert: raw => raw,
        render: value => value
      })
  ).toThrow();
});

test("converter to integer", async () => {
  const converter = new Converter<string, number>({
    emptyRaw: "",
    emptyImpossible: true,
    rawValidate: raw => /^\d+$/.test(raw),
    convert: raw => parseInt(raw, 10),
    render: value => value.toString()
  });

  const result = await converter.convert("3", options);
  expect(result).toBeInstanceOf(ConversionValue);
  expect((result as ConversionValue<number>).value).toEqual(3);

  const result2 = await converter.convert("not a number", options);
  expect(result2).toEqual(CONVERSION_ERROR);
});

test("converter with validate", async () => {
  const converter = new Converter<string, number>({
    emptyRaw: "",
    emptyImpossible: true,
    convert: raw => parseInt(raw, 10),
    render: value => value.toString(),
    validate: value => value <= 10
  });

  const result = await converter.convert("3", options);
  expect(result).toBeInstanceOf(ConversionValue);
  expect((result as ConversionValue<number>).value).toEqual(3);

  const result2 = await converter.convert("100", options);
  expect(result2).toEqual(CONVERSION_ERROR);
});

test("converter with async validate", async () => {
  const done: any[] = [];

  const converter = new Converter<string, string>({
    emptyRaw: "",
    emptyValue: "",
    convert: raw => raw,
    validate: async value => {
      await new Promise(resolve => {
        done.push(resolve);
      });
      return true;
    },
    render: value => value
  });

  const result = converter.convert("foo", options);
  done[0]();
  const v = await result;
  expect((v as ConversionValue<string>).value).toEqual("foo");
});

test("converter maybeNull with converter options", async () => {
  const M = types.model("M", {
    foo: types.maybeNull(types.string)
  });

  const form = new Form(M, {
    foo: new Field(converters.maybeNull(converters.decimal()))
  });

  const o = M.create({ foo: "36365.21" });

  const state = form.state(o, {
    converterOptions: {
      decimalSeparator: ",",
      thousandSeparator: ".",
      renderThousands: true
    }
  });
  const field = state.field("foo");
  await field.setRaw("36.365,20");
  expect(field.error).toBeUndefined();
  expect(field.raw).toEqual("36.365,20");
  expect(field.value).toEqual("36365.20");
});

test("convert can throw ConvertError", async () => {
  const converter = new Converter<string, string>({
    emptyRaw: "",
    emptyValue: "",
    convert: raw => {
      throw new ConvertError();
    },
    render: value => value
  });

  const result = await converter.convert("foo", options);
  expect(result).toEqual(CONVERSION_ERROR);
});

test("non-ConvertError bubbles up", async () => {
  const converter = new Converter<string, string>({
    emptyRaw: "",
    emptyValue: "",
    convert: raw => {
      throw new Error("Unexpected failure");
    },
    render: value => value
  });

  // we want to verify that this throws an error,
  // but toThrow doesn't work possibly due to the async
  // nature of convert. This is another way
  try {
    await converter.convert("foo", options);
  } catch (e) {
    expect(true).toBeTruthy();
    return;
  }
  // should never be reached
  expect(false).toBeTruthy();
});
