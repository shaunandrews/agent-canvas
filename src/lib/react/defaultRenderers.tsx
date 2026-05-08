import type {
  AgentCanvasRenderer,
  AgentCanvasRendererProps,
  CanvasNode,
  DocumentCanvasNode,
  FileCanvasNode,
  GroupCanvasNode,
  ImageCanvasNode,
  TextCanvasNode,
  VideoCanvasNode,
  WebsiteCanvasNode
} from "../types";
import { extractNodeText } from "../core/agent-context";

export const defaultRenderers: Record<CanvasNode["type"], AgentCanvasRenderer> = {
  document: DocumentNodeRenderer as AgentCanvasRenderer,
  text: TextNodeRenderer as AgentCanvasRenderer,
  image: ImageNodeRenderer as AgentCanvasRenderer,
  video: VideoNodeRenderer as AgentCanvasRenderer,
  website: WebsiteNodeRenderer as AgentCanvasRenderer,
  file: FileNodeRenderer as AgentCanvasRenderer,
  group: GroupNodeRenderer as AgentCanvasRenderer
};

function DocumentNodeRenderer({ node }: AgentCanvasRendererProps<DocumentCanvasNode>) {
  return (
    <article className="ac-node-content ac-document-node">
      <NodeHeader node={node} label="Document" />
      <div className="ac-document-body">{renderTextBlocks(node.content.markdown || node.content.excerpt || stripHtml(node.content.html) || "")}</div>
    </article>
  );
}

function TextNodeRenderer({ node }: AgentCanvasRendererProps<TextCanvasNode>) {
  return (
    <article className={`ac-node-content ac-text-node ac-text-node--${node.content.tone || "note"}`}>
      <NodeHeader node={node} label="Text" />
      <p>{node.content.text}</p>
    </article>
  );
}

function ImageNodeRenderer({ node }: AgentCanvasRendererProps<ImageCanvasNode>) {
  return (
    <figure className="ac-node-content ac-media-node">
      <img src={node.content.src} alt={node.content.alt || node.title || ""} draggable={false} />
      {(node.title || node.content.caption) && (
        <figcaption>
          {node.title && <strong>{node.title}</strong>}
          {node.content.caption && <span>{node.content.caption}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function VideoNodeRenderer({ node }: AgentCanvasRendererProps<VideoCanvasNode>) {
  return (
    <figure className="ac-node-content ac-media-node">
      <video src={node.content.src} poster={node.content.poster} controls />
      {(node.title || node.content.caption) && (
        <figcaption>
          {node.title && <strong>{node.title}</strong>}
          {node.content.caption && <span>{node.content.caption}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function WebsiteNodeRenderer({ node }: AgentCanvasRendererProps<WebsiteCanvasNode>) {
  const sandbox = node.content.sandbox || "allow-forms allow-popups allow-scripts allow-same-origin";

  return (
    <article className="ac-node-content ac-website-node">
      <NodeHeader node={node} label="Website" />
      <iframe
        title={node.title || node.content.url || "Website preview"}
        src={node.content.url}
        srcDoc={node.content.srcDoc}
        sandbox={sandbox}
      />
      {node.content.caption && <p>{node.content.caption}</p>}
    </article>
  );
}

function FileNodeRenderer({ node }: AgentCanvasRendererProps<FileCanvasNode>) {
  return (
    <article className="ac-node-content ac-file-node">
      <NodeHeader node={node} label={node.content.mimeType || "File"} />
      <div className="ac-file-glyph" aria-hidden="true">
        {fileInitials(node.content.name)}
      </div>
      <strong>{node.content.name}</strong>
      {node.content.sizeLabel && <span>{node.content.sizeLabel}</span>}
      {node.content.summary && <p>{node.content.summary}</p>}
    </article>
  );
}

function GroupNodeRenderer({ node }: AgentCanvasRendererProps<GroupCanvasNode>) {
  const count = node.content.children?.length || 0;
  return (
    <article className="ac-node-content ac-group-node">
      <NodeHeader node={node} label="Group" />
      <p>{node.content.label || node.description || "A spatial group for related canvas nodes."}</p>
      <span>{count} linked node{count === 1 ? "" : "s"}</span>
    </article>
  );
}

function NodeHeader({ node, label }: { node: CanvasNode; label: string }) {
  return (
    <header className="ac-node-header">
      <span>{label}</span>
      {node.title && <strong>{node.title}</strong>}
    </header>
  );
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
