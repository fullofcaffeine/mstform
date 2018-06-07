import { configure, IReactionDisposer } from "mobx";
import { getSnapshot, types } from "mobx-state-tree";
import { Converter, Field, Form, RepeatingForm, converters } from "../src";

test("changehook", async () => {
  const M = types
    .model("M", {
      c: types.number,
      b: types.number
    })
    .actions(self => ({
      setB(value: number) {
        self.b = value;
      }
    }));

  const touched: boolean[] = [];

  const form = new Form(M, {
    c: new Field(converters.number, {
      change: (node, value) => {
        touched.push(true);
        node.setB(value);
      }
    }),
    b: new Field(converters.number)
  });

  const o = M.create({ c: 1, b: 2 });

  const state = form.state(o);
  const c = state.field("c");
  const b = state.field("b");

  // we set it to 4 explicitly
  await c.setRaw("4");
  expect(b.raw).toEqual("4");
  // this immediately affects the underlying value
  expect(b.value).toEqual(4);

  // when we change it to something unvalid, change hook doesn't fire
  await c.setRaw("invalid");
  expect(b.raw).toEqual("4");
  expect(b.value).toEqual(4);

  await c.setRaw("17");
  expect(b.raw).toEqual("17");
  expect(b.value).toEqual(17);

  // we change b independently
  await b.setRaw("23");
  expect(b.raw).toEqual("23");

  let prevLength = touched.length;
  // validation shouldn't modify the value (it calls setRaw)
  await state.validate();
  expect(touched.length).toEqual(prevLength);
  expect(b.raw).toEqual("23");
  expect(b.value).toEqual(23);

  // a modification of `c` to the same value shouldn't modify the value either
  prevLength = touched.length;
  await c.setRaw("17");
  expect(touched.length).toEqual(prevLength);
  expect(b.raw).toEqual("23");
  expect(b.value).toEqual(23);
});
