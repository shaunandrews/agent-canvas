import type {
  AgentCanvasRenderer,
  AgentCanvasRendererProps,
  CanvasNode,
  DocumentCanvasNode,
  FileCanvasNode,
  ImageCanvasNode,
  SectionCanvasNode,
  TextCanvasNode,
  VideoCanvasNode,
  WebsiteCanvasNode
} from "../types";
import { extractNodeText } from "../core/agent-context";
import { File as FileIcon, FileText, Globe2, Image, Info, Type, Video } from "lucide-react";

export const defaultRenderers: Record<CanvasNode["type"], AgentCanvasRenderer> = {
  document: DocumentNodeRenderer as AgentCanvasRenderer,
  text: TextNodeRenderer as AgentCanvasRenderer,
  image: ImageNodeRenderer as AgentCanvasRenderer,
  video: VideoNodeRenderer as AgentCanvasRenderer,
  website: WebsiteNodeRenderer as AgentCanvasRenderer,
  file: FileNodeRenderer as AgentCanvasRenderer,
  section: SectionNodeRenderer as AgentCanvasRenderer
};

function DocumentNodeRenderer({ node }: AgentCanvasRendererProps<DocumentCanvasNode>) {
  return (
    <article className="ac-node-content ac-document-node">
      <NodeHeader node={node} label="Document" />
      <div className="ac-node-surface">
        <div className="ac-document-body">{renderTextBlocks(node.content.markdown || node.content.excerpt || stripHtml(node.content.html) || "")}</div>
      </div>
    </article>
  );
}

function TextNodeRenderer({ node }: AgentCanvasRendererProps<TextCanvasNode>) {
  return (
    <article className={`ac-node-content ac-text-node ac-text-node--${node.content.tone || "note"}`}>
      <NodeHeader node={node} label="Text" />
      <div className="ac-node-surface">
        <p>{node.content.text}</p>
      </div>
    </article>
  );
}

function ImageNodeRenderer({ node }: AgentCanvasRendererProps<ImageCanvasNode>) {
  return (
    <figure className="ac-node-content ac-media-node">
      <NodeHeader node={node} label="Image" />
      <div className="ac-node-surface ac-media-surface">
        <img src={node.content.src} alt={node.content.alt || node.title || ""} draggable={false} />
      </div>
    </figure>
  );
}

function VideoNodeRenderer({ node }: AgentCanvasRendererProps<VideoCanvasNode>) {
  return (
    <figure className="ac-node-content ac-media-node">
      <NodeHeader node={node} label="Video" />
      <div className="ac-node-surface ac-media-surface">
        <video src={node.content.src} poster={node.content.poster} controls />
      </div>
    </figure>
  );
}

function WebsiteNodeRenderer({ node, selected }: AgentCanvasRendererProps<WebsiteCanvasNode>) {
  const sandbox = node.content.sandbox || "allow-forms allow-popups allow-scripts allow-same-origin";

  return (
    <article className="ac-node-content ac-website-node">
      <NodeHeader node={node} label="Website" />
      <div className="ac-node-surface ac-website-surface">
        <iframe
          title={node.title || node.content.url || "Website preview"}
          src={node.content.url}
          srcDoc={node.content.srcDoc}
          sandbox={sandbox}
          style={{ pointerEvents: selected ? "auto" : "none" }}
        />
      </div>
    </article>
  );
}

function FileNodeRenderer({ node }: AgentCanvasRendererProps<FileCanvasNode>) {
  return (
    <article className="ac-node-content ac-file-node">
      <NodeHeader node={node} label={node.content.mimeType || "File"} />
      <div className="ac-node-surface">
        <div className="ac-file-glyph" aria-hidden="true">
          {fileInitials(node.content.name)}
        </div>
        <strong>{node.content.name}</strong>
        {node.content.sizeLabel && <span>{node.content.sizeLabel}</span>}
        {node.content.summary && <p>{node.content.summary}</p>}
      </div>
    </article>
  );
}

function SectionNodeRenderer({ node }: AgentCanvasRendererProps<SectionCanvasNode>) {
  return (
    <article className="ac-node-content ac-section-node">
      <NodeHeader node={node} label="Section" />
      <div className="ac-node-surface ac-section-surface" aria-hidden="true" />
    </article>
  );
}

function NodeHeader({ node, label }: { node: CanvasNode; label: string }) {
  const TypeIcon = node.type === "section" ? undefined : getNodeTypeIcon(node.type);
  const description = getNodeHeaderDescription(node);

  return (
    <header className="ac-node-header">
      <strong {...(node.type === "section" ? { "data-agent-section-title": "" } : {})}>{node.title || label}</strong>
      <span className="ac-node-header-actions">
        {description && (
          <span
            aria-label={`Description: ${description}`}
            className="ac-node-header-icon"
            data-agent-node-description-icon=""
            title={description}
          >
            <Info size={14} strokeWidth={2} />
          </span>
        )}
        {TypeIcon && (
          <span aria-label={`${label} node`} className="ac-node-header-icon" data-agent-node-type-icon={node.type} title={label}>
            <TypeIcon size={14} strokeWidth={2} />
          </span>
        )}
      </span>
    </header>
  );
}

export function getNodeTypeIcon(type: CanvasNode["type"]) {
  if (type === "document") return FileText;
  if (type === "text") return Type;
  if (type === "image") return Image;
  if (type === "video") return Video;
  if (type === "website") return Globe2;
  return FileIcon;
}

export function getNodeHeaderDescription(node: CanvasNode) {
  if (node.description) return node.description;
  if (node.type === "image" || node.type === "video") return node.content.caption;
  if (node.type === "website") return node.content.caption || node.content.url;
  if (node.type === "file") return node.content.summary;
  if (node.type === "section") return node.content.description || node.description;
  return undefined;
}

function renderTextBlocks(text: string) {
  if (!text.trim()) return <p className="ac-empty-text">No text content.</p>;

  return text
    .trim()
    .split(/\n{2,}/)
    .map((block, index) => {
      const trimmed = block.trim();
      if (trimmed.startsWith("# ")) return <h2 key={index}>{trimmed.replace(/^#\s+/, "")}</h2>;
      if (trimmed.startsWith("## ")) return <h3 key={index}>{trimmed.replace(/^##\s+/, "")}</h3>;
      if (/^[-*]\s/m.test(trimmed)) {
        return (
          <ul key={index}>
            {trimmed
              .split("\n")
              .map((line) => line.replace(/^[-*]\s+/, "").trim())
              .filter(Boolean)
              .map((item) => (
                <li key={item}>{item}</li>
              ))}
          </ul>
        );
      }
      return <p key={index}>{trimmed}</p>;
    });
}

function stripHtml(html?: string) {
  return html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function fileInitials(name: string) {
  const extension = name.split(".").pop();
  return extension ? extension.slice(0, 4).toUpperCase() : "FILE";
}

export function getNodeAccessibleLabel(node: CanvasNode) {
  return [node.type, node.title, extractNodeText(node)].filter(Boolean).join(": ");
}
