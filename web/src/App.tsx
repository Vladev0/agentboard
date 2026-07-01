import { useEffect } from "react";
import { Board } from "./components/Board.js";
import { Sidebar } from "./components/Sidebar.js";
import { TaskDetail } from "./components/TaskDetail.js";
import { useStore } from "./store.js";
import { vaultSocket } from "./ws.js";

export default function App() {
  const init = useStore((s) => s.init);
  const onVaultEvent = useStore((s) => s.onVaultEvent);
  const selectedTaskId = useStore((s) => s.selectedTaskId);

  useEffect(() => {
    init();
    vaultSocket.connect();
    return vaultSocket.subscribe(onVaultEvent);
  }, [init, onVaultEvent]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-neutral-900 dark:bg-[#08090a] dark:text-neutral-100">
      <Sidebar />
      <Board />
      {selectedTaskId && <TaskDetail />}
    </div>
  );
}
