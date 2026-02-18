import type { Annotation } from "agentation";

export function buildAnnotationMarkdown(
  pageUrl: string,
  annotations: Annotation[],
): string {
  if (annotations.length === 0) {
    return "";
  }

  let output = `## Page Feedback: ${pageUrl}\n\n`;

  annotations.forEach((annotation, index) => {
    output += `### ${index + 1}. ${annotation.element}\n`;
    output += `**Location:** ${annotation.elementPath}\n`;

    if (annotation.selectedText) {
      output += `**Selected text:** \"${annotation.selectedText}\"\n`;
    }

    output += `**Feedback:** ${annotation.comment}\n\n`;
  });

  return output.trim();
}
