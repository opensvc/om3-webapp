import React from "react";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {act, render, screen} from "@testing-library/react";
import "../../i18n";
import {DRAFT_VALIDATION_DELAY_MS, DraftValidation} from "../ConfigValidation";

const URL = "/api/object/path/ns1/svc/oc3/config/validate";
const answer = (status, body) => Promise.resolve({
    ok: status < 300,
    status,
    clone() {
        return {json: () => Promise.resolve(body)};
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: {get: () => "application/json"},
});

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem("authToken", "tok");
});

afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
});

const rest = async () => {
    await act(async () => {
        vi.advanceTimersByTime(DRAFT_VALIDATION_DELAY_MS);
    });
    await act(async () => {});
};

describe("a draft validated as it is edited", () => {
    test("sent once it rested, nothing before; its alerts said, errors first", async () => {
        global.fetch = vi.fn(() => answer(200, {kind: "ConfigAlertList", items: [
            {level: "warning", kind: "conflicting strategies", key: "ip#1", comment: "static and ipam"},
            {level: "error", kind: "denied", key: "container#1.privileged", comment: "a privileged container requires the root grant"},
        ]}));
        const {rerender} = render(<DraftValidation url={URL} text={"[ip#1]\nname = a\n"}/>);
        rerender(<DraftValidation url={URL} text={"[ip#1]\nname = a\nnetwork = default\n"}/>);
        expect(global.fetch).not.toHaveBeenCalled();
        await rest();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, init] = vi.mocked(global.fetch).mock.calls[0];
        expect(url).toBe(URL);
        expect(init).toMatchObject({method: "POST", body: "[ip#1]\nname = a\nnetwork = default\n"});
        expect(screen.getByText("1 error, 1 warning")).toBeInTheDocument();
        const items = [...document.querySelectorAll("[data-alert]")].map((e) => e.dataset.alert);
        expect(items).toEqual(["error", "warning"]);
        expect(screen.getByText("a privileged container requires the root grant")).toBeInTheDocument();
        expect(screen.getByText("conflicting strategies")).toBeInTheDocument();
    });

    test("clean, nothing said; with errors, said and told, kept on display while checked again; none once fixed", async () => {
        let reply;
        const onErrors = vi.fn();
        global.fetch = vi.fn(() => answer(200, {kind: "ConfigAlertList", items: []}));
        const {rerender} = render(<DraftValidation url={URL} text="[DEFAULT]\n" onErrors={onErrors}/>);
        await rest();
        expect(screen.queryByText(/The configuration is valid/)).toBeNull();
        expect(onErrors).toHaveBeenLastCalledWith(0);
        global.fetch = vi.fn(() => answer(200, {kind: "ConfigAlertList", items: [
            {level: "error", kind: "denied", key: "DEFAULT.nodes", comment: "requires the root grant"},
        ]}));
        rerender(<DraftValidation url={URL} text={"[DEFAULT]\nnodes = n1\n"} onErrors={onErrors}/>);
        await rest();
        expect(screen.getByText("requires the root grant")).toBeInTheDocument();
        expect(onErrors).toHaveBeenLastCalledWith(1);
        global.fetch = vi.fn(() => new Promise((resolve) => {
            reply = resolve;
        }));
        rerender(<DraftValidation url={URL} text={"[DEFAULT]\nnodes = *\n"} onErrors={onErrors}/>);
        await rest();
        expect(screen.getByText("Validating the configuration")).toBeInTheDocument();
        expect(screen.getByText("requires the root grant")).toBeInTheDocument();
        await act(async () => reply({ok: true, status: 200, json: () => Promise.resolve({items: []})}));
        expect(screen.queryByText("Validating the configuration")).toBeNull();
        expect(screen.queryByText("requires the root grant")).toBeNull();
        expect(onErrors).toHaveBeenLastCalledWith(0);
    });

    test("nothing said by a daemon older than the validation, nor without a url", async () => {
        global.fetch = vi.fn(() => answer(404, {message: "Not Found"}));
        const {container, rerender} = render(<DraftValidation url={URL} text="[DEFAULT]\n"/>);
        await rest();
        expect(container.querySelector("[data-draft-validation]")).toBeNull();
        global.fetch = vi.fn();
        rerender(<DraftValidation url="" text="[DEFAULT]\n"/>);
        await rest();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(container.querySelector("[data-draft-validation]")).toBeNull();
    });
});
