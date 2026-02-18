import React, { useCallback } from "react";
import { Agentation, type Annotation } from "agentation";

import { generatePlaywrightScript } from "./generation-client";
import { saveScriptAsPythonFile } from "./script-download";
import { RUNTIME_CONFIG } from "../shared/runtime-config";

export function AgentationExtensionApp(): JSX.Element {
  const onGenerateScript = useCallback(
    async (output: string, annotations: Annotation[]) => {
      if (annotations.length === 0) {
        return;
      }

      try {
        const result = await generatePlaywrightScript({
          pageUrl: window.location.href,
          markdown: output,
          annotations,
        });

        await navigator.clipboard.writeText(result.script);
        const savedFile = await saveScriptAsPythonFile(
          result.script,
          result.testName,
        );
        console.info(
          `[Agentation Extension] Generated ${result.testName}, copied to clipboard, saved as ${savedFile}`,
        );
      } catch (generationError) {
        console.warn(
          "[Agentation Extension] Script generation failed:",
          generationError,
        );
        throw generationError;
      }
    },
    [],
  );

  return (
    <Agentation
      endpoint={RUNTIME_CONFIG.mcpEndpoint}
      onGenerateScript={onGenerateScript}
    />
  );
}
