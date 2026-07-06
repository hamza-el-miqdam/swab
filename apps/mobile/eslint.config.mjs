// Mobile lint = Expo preset (React/React Native/react-hooks) + the repo base.
// Base comes AFTER the preset so its type-aware rules and the Prettier
// rule-disabling entry keep the last word.
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

import base from "../../eslint.config.mjs";

export default defineConfig([...expoConfig, ...base]);
