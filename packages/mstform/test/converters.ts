import {
  CONVERSION_ERROR,
  ConversionValue,
  IConverter,
  converters
} from "../src";

async function check(
  converter: IConverter<any, any>,
  value: any,
  expected: any
) {
  const r = await converter.convert(value);
  expect(r).toBeInstanceOf(ConversionValue);
  expect((r as ConversionValue<any>).value).toEqual(expected);
}

async function fails(converter: IConverter<any, any>, value: any) {
  const r = await converter.convert(value);
  expect(r).toBe(CONVERSION_ERROR);
}

test("string converter", async () => {
  await check(converters.string, "foo", "foo");
  await check(converters.string, "", "");
});

test("number converter", async () => {
  await check(converters.number, "3", 3);
  await check(converters.number, "3.14", 3.14);
  await check(converters.number, ".14", 0.14);
  await check(converters.number, "19.14", 19.14);
  await check(converters.number, "19.", 19);
  await check(converters.number, "-3.14", -3.14);
  await fails(converters.number, "foo");
  await fails(converters.number, "1foo");
  await fails(converters.number, "");
});

test("integer converter", async () => {
  await check(converters.integer, "3", 3);
  await fails(converters.integer, "3.14");
  await fails(converters.integer, ".14");
  await check(converters.integer, "0", 0);
  await check(converters.integer, "-3", -3);
  await fails(converters.integer, "foo");
  await fails(converters.integer, "1foo");
  await fails(converters.integer, "");
});

test("decimal converter", async () => {
  await check(converters.decimal(4, 2), "3", "3");
  await check(converters.decimal(4, 2), "3.14", "3.14");
  await check(converters.decimal(4, 2), "43.14", "43.14");
  await check(converters.decimal(4, 2), "4313", "4313");

  await check(converters.decimal(4, 2), "-3.14", "-3.14");
  await check(converters.decimal(4, 2), "0", "0");
  await check(converters.decimal(4, 2), ".14", ".14");
  await check(converters.decimal(4, 2), "14.", "14.");
  await fails(converters.decimal(4, 2), "foo");
  await fails(converters.decimal(4, 2), "1foo");
  await fails(converters.decimal(4, 2), "");
  await fails(converters.decimal(4, 2), "12345.34");
  await fails(converters.decimal(4, 2), "12.444");
});

test("maybe number converter", async () => {
  await check(converters.maybe(converters.number), "3", 3);
  await check(converters.maybe(converters.number), "", null);
});