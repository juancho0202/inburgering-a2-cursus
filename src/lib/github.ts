/** The public repository of the course. Content mistakes are reported there as issues. */
export const REPO_URL = "https://github.com/juancho0202/inburgering-a2-cursus";
const BRANCH = "main";

export interface IssueFields {
  itemId: string;
  /** Path relative to data/course, e.g. "basis/units/basis-tijd.json". */
  file: string;
  title: string;
  note: string;
}

/**
 * A "new issue" link with the form in .github/ISSUE_TEMPLATE/inhoud-fout.yml filled in.
 * The query keys are the field ids of that form; keep them in sync.
 */
export function newIssueUrl({ itemId, file, title, note }: IssueFields): string {
  const params = new URLSearchParams({
    template: "inhoud-fout.yml",
    title: `Fout in ${itemId}`,
    onderdeel: itemId,
    bestand: `${REPO_URL}/blob/${BRANCH}/data/course/${file}`,
    vraag: title,
    toelichting: note.trim(),
  });
  return `${REPO_URL}/issues/new?${params}`;
}
