import { AtlasView } from "./components/atlas/AtlasView";

export default function App() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background justify-center">
      <div className="flex w-full max-w-[1800px] min-h-0">
        <AtlasView />
      </div>
    </div>
  );
}
