import { useEffect } from "react";
import { Board } from "./components/Board.js";
import { NotesIndex } from "./components/NotesIndex.js";
import { NoteView } from "./components/NoteView.js";
import { Sidebar } from "./components/Sidebar.js";
import { TaskDetail } from "./components/TaskDetail.js";
import { needsAttentionCount, useStore } from "./store.js";
import { vaultSocket } from "./ws.js";

export default function App() {
  const init = useStore((s) => s.init);
  const onVaultEvent = useStore((s) => s.onVaultEvent);
  const selectedTaskId = useStore((s) => s.selectedTaskId);
  const selectedNoteId = useStore((s) => s.selectedNoteId);
  const memoryOpen = useStore((s) => s.memoryOpen);
  const locale = useStore((s) => s.locale);
  const projects = useStore((s) => s.projects);

  useEffect(() => {
    init();
    vaultSocket.connect();
    return vaultSocket.subscribe(onVaultEvent);
  }, [init, onVaultEvent]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const attention = needsAttentionCount(projects);
    document.title = attention > 0 ? `(${attention}) AgentBoard` : "AgentBoard";
  }, [projects]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-neutral-900 dark:bg-[#08090a] dark:text-neutral-100">
      <Sidebar />
      {/* A note opens on top of a task or the index; closing it returns there. */}
      {selectedNoteId ? (
        <NoteView />
      ) : selectedTaskId ? (
        <TaskDetail />
      ) : memoryOpen ? (
        <NotesIndex />
      ) : (
        <Board />
      )}
    </div>
  );
}
