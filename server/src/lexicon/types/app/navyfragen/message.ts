/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from "@atproto/lexicon";
import { CID } from "multiformats/cid";

import { lexicons } from "../../../lexicons";
import { isObj, hasProp } from "../../../util";

export interface Record {
  message: string;
  createdAt: string;
  recipient: string;
  [k: string]: unknown;
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, "$type") &&
    (v.$type === "app.navyfragen.message#main" || v.$type === "app.navyfragen.message")
  );
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate("app.navyfragen.message#main", v);
}
