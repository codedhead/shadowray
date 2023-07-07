import { FunctionalComponent, h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { LoadedSceneResult } from "../../scene_loader";
import rtCanvas from "./rt_canvas";
import FPSStats from "react-fps-stats";
import style from './style.css';

type CanvasProps = {
  scene?: LoadedSceneResult;
  onSceneLoaded: () => void;
};
const Canvas: FunctionalComponent<CanvasProps> = ({ scene, onSceneLoaded }) => {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasEl.current;
    if (!canvas || !scene) return;
    setPaused(true);
    (async (): Promise<void> => {
      await rtCanvas.setupContext(canvas);
      rtCanvas.loadScene(scene, () => {
        onSceneLoaded();
        setPaused(false);
      });
    })();
  }, [scene]);

  const toggleAppPause = (): void => {
    setPaused(!paused);
  };

  useEffect(() => {
    rtCanvas.toggleStartPause(!paused);
  }, [paused]);

  return (<div style={{ position: 'relative' }}>
    <canvas ref={canvasEl} width={512} height={512} style={{ background: 'black' }} />
    <div class={style.actionContainer}>
      <a class={style.toggleButton} title='Pause/Resume' onClick={toggleAppPause} ><img height='48' src={
        `/assets/${paused ? 'start' : 'pause'}.png`
      } /></a>
      <div style={{ flexGrow: 1 }} />
      <div class={style.fps}><FPSStats paused={paused} capacity={20} /></div>
    </div>
  </div>);
};

export default Canvas;