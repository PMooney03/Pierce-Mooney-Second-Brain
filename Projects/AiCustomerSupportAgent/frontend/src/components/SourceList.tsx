import type { Source } from "../types";
import "./SourceList.css";

interface Props {
  sources: Source[];
}

export default function SourceList({ sources }: Props) {
  if (sources.length === 0) {
    return (
      <p className="sources-empty">No documentation sections matched this question.</p>
    );
  }

  return (
    <div className="sources">
      <h4 className="sources-heading">Sources used</h4>
      <ul className="sources-list">
        {sources.map((s) => (
          <li key={s.id} className="source-item">
            <strong>{s.title}</strong>
            <p>{s.snippet}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
