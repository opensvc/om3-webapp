import { createRef } from "react";
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox, Field, Input, Select, Textarea } from "../components/Field";

describe("form controls", () => {
  test("Input renders a text field with the control classes and forwards its ref", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input aria-label="Name" ref={ref} className="extra" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(ref.current).toBe(input);
    expect(input).toHaveClass("border-line", "h-8", "w-full", "extra");
  });

  test("Textarea renders a multi-line field and forwards its ref", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea aria-label="Comment" ref={ref} />);
    const area = screen.getByRole("textbox", { name: "Comment" });
    expect(area.tagName).toBe("TEXTAREA");
    expect(ref.current).toBe(area);
  });

  test("Select renders its options and changes value", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select aria-label="Size" ref={ref} defaultValue="s">
        <option value="s">Small</option>
        <option value="l">Large</option>
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "Size" });
    expect(ref.current).toBe(select);
    await user.selectOptions(select, "l");
    expect(select).toHaveValue("l");
  });

  test("Checkbox without label renders the bare box", () => {
    const { container } = render(<Checkbox aria-label="Pick" />);
    const box = screen.getByRole("checkbox", { name: "Pick" });
    expect(container.firstChild).toBe(box);
  });

  test("Checkbox with label is named by it and toggles on a click on the label", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox label="Remember me" ref={ref} />);
    const box = screen.getByRole("checkbox", { name: "Remember me" });
    expect(ref.current).toBe(box);
    expect(box).not.toBeChecked();
    await user.click(screen.getByText("Remember me"));
    expect(box).toBeChecked();
  });
});

describe("Field", () => {
  test("ties the label to the control", () => {
    render(<Field label="Name">{(control) => <Input {...control} />}</Field>);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
  });

  test("without hint nor error, no aria-describedby nor aria-invalid", () => {
    render(<Field label="Name">{(control) => <Input {...control} />}</Field>);
    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  test("describes the control by its hint", () => {
    render(
      <Field label="Name" hint="Lowercase only">
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAccessibleDescription("Lowercase only");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  test("describes the control by its hint and error, and marks it invalid", () => {
    render(
      <Field label="Name" hint="Lowercase only" error="Required">
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAccessibleDescription("Lowercase only Required");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toBeInvalid();
  });

  test("an empty error is no error", () => {
    render(
      <Field label="Name" error="">
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});
