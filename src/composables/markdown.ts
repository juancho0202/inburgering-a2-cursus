import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: false, breaks: false });

export const renderMd = (src: string) => md.render(src);
export const renderMdInline = (src: string) => md.renderInline(src);
