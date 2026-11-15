const scope = globalThis as { process?: { env: Record<string, string>; cwd(): string } };

scope.process ??= { env: {}, cwd: () => '/' };

/** The language of the plugin's own messages, which it reads from `PVF_LANG`. */
export function setPluginLanguage(language: string): void {
  scope.process!.env.PVF_LANG = language;
}
