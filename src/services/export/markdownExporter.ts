import { InterviewPrepBriefing } from '../../types/interview';

/**
 * Converts an InterviewPrepBriefing into clean GitHub-flavored Markdown
 */
export function convertBriefingToMarkdown(briefing: InterviewPrepBriefing): string {
  let md = `# Interview Prep Cheat Sheet: ${briefing.jobTitle}\n`;
  md += `**Company**: ${briefing.companyName}  \n`;
  md += `**Generated**: ${new Date(briefing.createdAt).toLocaleDateString()} via RezBuilder\n\n`;
  md += `---\n\n`;

  // Role Synthesis
  md += `## 🎯 What This Role Actually Cares About\n\n`;
  md += `${briefing.roleSynthesis}\n\n`;
  md += `---\n\n`;

  // Core Concepts
  if (briefing.coreConcepts && briefing.coreConcepts.length > 0) {
    md += `## 💡 Core Technologies & Concepts to Know\n\n`;
    briefing.coreConcepts.forEach((c) => {
      md += `### ${c.concept} \`[${c.category}]\`\n`;
      md += `${c.explanation}\n\n`;
    });
    md += `---\n\n`;
  }

  // Technical Questions
  if (briefing.technicalQuestions && briefing.technicalQuestions.length > 0) {
    md += `## 🛠️ Likely Technical Questions & Talking Points\n\n`;
    briefing.technicalQuestions.forEach((q, idx) => {
      md += `### ${idx + 1}. ${q.question} \`[${q.category}]\`\n\n`;
      md += `**Talking Points:**\n`;
      q.suggestedTalkingPoints.forEach((pt) => {
        md += `- ${pt}\n`;
      });
      if (q.keyTermsToMention && q.keyTermsToMention.length > 0) {
        md += `\n**Key Terms to Mention:** ${q.keyTermsToMention.map((t) => `\`${t}\``).join(', ')}\n`;
      }
      md += `\n`;
    });
    md += `---\n\n`;
  }

  // Behavioral Questions
  if (briefing.behavioralQuestions && briefing.behavioralQuestions.length > 0) {
    md += `## 🤝 Likely Behavioral Questions & STAR Tips\n\n`;
    briefing.behavioralQuestions.forEach((b, idx) => {
      md += `### ${idx + 1}. ${b.question}\n\n`;
      md += `**Targeted Value:** \`${b.targetedValue}\`\n\n`;
      md += `**STAR Strategy:** ${b.starFrameworkTip}\n\n`;
    });
    md += `---\n\n`;
  }

  // Questions to Ask Interviewer
  if (briefing.questionsToAskInterviewer && briefing.questionsToAskInterviewer.length > 0) {
    md += `## ❓ Smart Questions to Ask the Interviewer\n\n`;
    briefing.questionsToAskInterviewer.forEach((i, idx) => {
      md += `**${idx + 1}. "${i.question}"**  \n`;
      md += `*Purpose: ${i.purpose}*\n\n`;
    });
  }

  return md;
}

/**
 * Triggers a browser download for the Markdown cheat sheet
 */
export function downloadMarkdownFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.md') ? filename : `${filename}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
