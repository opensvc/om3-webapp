import {parseObjectPath} from "../utils/objectUtils.jsx";

/** The kinds of the datastores, what a key is read from. */
const DATASTORE_KINDS = ["cfg", "sec", "usr"];
/** What only the node resolves: a pattern, a reference. */
const UNRESOLVED = /[*?[{]/;
/** The references om resolves from the object alone, as the path of self says them. */
const SELF_REFERENCES = /\{(name|svcname|namespace|kind|path|svcpath)\}/g;

/**
 * A word of the configuration of `self`, its references to self resolved as om
 * does (`{name}`, `{namespace}`, `{kind}`, `{path}`, their `svc` aliases): what is
 * left of a reference or a pattern, only the node resolves.
 */
export function resolveSelf(word, self) {
    if (self === undefined || !word.includes("{")) return word;
    const own = parseObjectPath(self);
    const values = {
        name: own.name,
        svcname: own.name,
        namespace: own.namespace,
        kind: own.kind,
        path: self,
        svcpath: self,
    };
    return word.replace(SELF_REFERENCES, (_, ref) => values[ref]);
}
/** Where `from <datastore> key <name>` stands in a value. */
export const KEY_SOURCE = /(^|\s)(from)(\s+)(\S+)(\s+)(key)(\s+)(\S+)/;

/**
 * The path of the datastore a word after `from` names in the configuration of
 * `self`, as om reads it (ParsePathRel, ParseKeyMetaRelSelf): "." is self, `./sec/ca`
 * is of the namespace of self, and `sec/ca` of the root namespace, whatever self's.
 * The path as the objects are known by, which the root namespace is not part of.
 * Undefined when it names no datastore known here.
 */
export function datastorePath(word, self) {
    word = resolveSelf(word, self);
    if (UNRESOLVED.test(word)) return undefined;
    const own = parseObjectPath(self);
    if (word === ".") return DATASTORE_KINDS.includes(own.kind) ? self : undefined;
    const parts = word.split("/");
    if (parts.length < 2 || parts.length > 3 || parts.some((part) => part === "")) return undefined;
    const [namespace, kind, name] = parts.length === 3 ? parts : ["root", ...parts];
    if (!DATASTORE_KINDS.includes(kind)) return undefined;
    const resolved = namespace === "." ? own.namespace : namespace;
    return resolved === "root" ? `${kind}/${name}` : `${resolved}/${kind}/${name}`;
}

/** A key of a datastore, by its name, its references to self resolved: not a pattern of names, nor another reference. */
export const isKeyName = (word, self) => !UNRESOLVED.test(resolveSelf(word, self));
