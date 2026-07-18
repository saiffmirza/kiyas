import { test } from "node:test";
import assert from "node:assert";
import { sameFinding, propertyFamilies } from "../src/compare/finding-key.js";

// Regression fixtures: real model outputs from the 2026-07-18 eval run that
// the matcher originally failed to match against their goldens.

test("navbar gap: 'nav links' matches 'navigation menu items'", () => {
  assert.ok(
    sameFinding(
      {
        element: "navigation menu items (Dashboard, Events, Reports, Settings)",
        property: "gap/spacing between nav links",
      },
      { element: "nav links", property: "gap" }
    )
  );
});

test("badges radius: plural/singular element match", () => {
  assert.ok(
    sameFinding(
      {
        element: "badge components (Passed, Pending, Failed, Skipped)",
        property: "border-radius",
      },
      { element: "badges", property: "border-radius" }
    )
  );
});

test("pricing border: compound property and partial element", () => {
  assert.ok(
    sameFinding(
      { element: "Pro card border", property: "border-color / border-width" },
      { element: "pro plan card", property: "border" }
    )
  );
});

test("card padding: compound 'height / padding' matches 'padding'", () => {
  assert.ok(
    sameFinding(
      { element: "card container", property: "height / padding" },
      { element: "card", property: "padding" }
    )
  );
});

test("border-radius does NOT collapse into border", () => {
  assert.ok(!propertyFamilies("border-radius").has("border"));
  assert.ok(
    !sameFinding(
      { element: "card", property: "border-radius" },
      { element: "card", property: "border-width" }
    )
  );
});

test("different property families never match", () => {
  assert.ok(
    !sameFinding(
      { element: "hero heading", property: "font-size" },
      { element: "hero heading", property: "font-weight" }
    )
  );
});

test("unrelated elements with same property do not match", () => {
  assert.ok(
    !sameFinding(
      { element: "hero heading", property: "color" },
      { element: "footer copyright text", property: "color" }
    )
  );
});
