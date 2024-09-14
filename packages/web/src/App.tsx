import "./App.css";
import Onboarding from "./components/Onboarding";
import InterstellarLogo from "./assets/interstellar.svg";

function App() {
  return (
    <>
      <header className=" text-white p-4 flex items-center justify-center h-[250px]">
        <div className="w-full">
          <img src={InterstellarLogo} />
        </div>
      </header>
      <div className="flex flex-col">
        <Onboarding />
      </div>
    </>
  );
}

export default App;
