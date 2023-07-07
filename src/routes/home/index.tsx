import { Monaco, useMonaco } from '@monaco-editor/react';
import { FunctionalComponent, h, Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import Canvas from '../../components/canvas';
import Editor from '../../components/editor';
import Header from '../../components/header';
import getGPUDevice from '../../device';
import { AppId, AppInfo } from '../../rt_app_info';
import SceneLoader, { LoadedSceneResult } from '../../scene_loader';
import style from './style.css';
import { registerLanguage } from "../../monarch_lang";
import { conf as glslLangConf, language as glslLangDef } from '../../glsl_lang';

const EXAMPLES = [{
  id: 'cbox-glass',
  name: 'Cornell Box - Glasses',
}, {
  id: 'triangle',
  name: 'Triangle',
}, {
  id: 'cbox',
  name: 'Cornell Box',
}, {
  id: 'dragon',
  name: 'Dragon - Depth of field',
}, {
  id: 'teapot',
  name: 'Teapot',
}];

const DEFAULT_APP_INFO: AppInfo = {
  id: '_blank',
  name: 'new app',
  sceneConfig: {
    shaderStage: -1,
    name: 'Scene',
    filename: 'Scene.json',
    code: "{}",
    path: '_blank/Scene.json',
  },
  shaders: [{
    shaderStage: 0,
    name: 'ray',
    filename: 'ray.rgen',
    path: '_blank/ray.rgen',
    code: `void main() {
  
}`,
  }]
}

// TODO: ensure filename is within current directory
function filenameSplit(fname: string): [string, string] {
  if (fname.indexOf('/') !== -1 || fname.indexOf('\\') !== -1) {
    throw `invalid filename: ${fname}`;
  }
  const dot = fname.lastIndexOf('.');
  if (dot === -1) {
    throw `invalid filename: ${fname}`;
  }
  return [fname.slice(0, dot), fname.slice(dot + 1)];
}

async function loadApp(appId: AppId): Promise<AppInfo> {
  const metadata = await (await fetch(`/assets/scenes/${appId.id}/metadata`)).text();
  const files = metadata.split(/\r\n|\r|\n/).map(f => f.trim()).filter(f => !!f);
  const app: AppInfo = {
    id: appId.id,
    name: appId.name,
    shaders: [],
  } as unknown as AppInfo;
  const contents = await Promise.all(files.map(f => fetch(`/assets/scenes/${appId.id}/${f}`).then(r => r.text())).concat([
    (await fetch(`/assets/scenes/${appId.id}/scene.jsonc`)).text()
  ]));
  app.sceneConfig = {
    shaderStage: -1,
    name: 'Scene',
    filename: 'Scene.json',
    path: `${appId.id}/Scene.json`,
    code: contents[contents.length - 1],
  };
  for (let i = 0; i < files.length; i++) {
    if (files[i].toLowerCase() === 'common.glsl') {
      app.commonCode = {
        shaderStage: -1,
        name: 'Common',
        filename: 'Common.glsl',
        path: `${appId.id}/Common.glsl`,
        code: contents[i],
      };
    } else {
      let stage = -1;
      const [name, ext] = filenameSplit(files[i]);
      switch (ext.toLowerCase()) {
        case 'rgen':
          stage = 0;
          break;
        case 'rmiss':
          stage = 1;
          break;
        case 'rint':
          stage = 2;
          break;
        case 'rchit':
          stage = 3;
          break;
        case 'rahit':
          stage = 4;
          break;
        default:
          throw `unknown file extension: ${files[i]}`;
      }
      app.shaders.push({
        shaderStage: stage,
        name,
        filename: files[i],
        code: contents[i],
        path: `${app.id}/${files[i]}`,
      });
    }
  }
  return app;
}

const START_ON_LOAD = true;

const HomeWrap: FunctionalComponent = () => {
  const monaco = useMonaco();
  useEffect(() => {
    if (monaco) {
      // console.log("here is the monaco instance:", monaco);
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        allowComments: true,
      });
      registerLanguage(monaco.languages, {
        id: 'glsl',
        extensions: ['.glsl'],
        loader: () => (Promise.resolve({ conf: glslLangConf, language: glslLangDef })),
      });
    }
  }, [monaco]);
  return monaco ? <Home monaco={monaco} /> : <div>waiting for editor to load</div>;
};

type HomeProps = { monaco: Monaco };
const Home: FunctionalComponent<HomeProps> = ({ monaco }) => {
  const [currentAppId, setCurrentAppId] = useState(EXAMPLES[0]); // cbox-glass
  const [currentApp, setCurrentApp] = useState<AppInfo | null>(null);
  const [dirty, setDirty] = useState(false);
  const [renderScene, setRenderScene] = useState<LoadedSceneResult | undefined>(undefined);
  const [sceneLoading, setSceneLoading] = useState(false);

  const compileAndRunCurrentApp = (): void => {
    if (sceneLoading) {
      console.error('scene already loading');
      return;
    }
    if (!currentApp) return;
    if (!monaco) {
      throw 'missing monacoRef'
    }
    setSceneLoading(true);
    (async (): Promise<void> => {
      const device = await getGPUDevice();
      if (device) {
        const sl = new SceneLoader();
        setRenderScene(await sl.load(monaco, currentApp, device));
      }
    })();
  };

  useEffect((): void => {
    // TODO: start only after editor ready
    if (START_ON_LOAD && currentApp) {
      compileAndRunCurrentApp();
    }
  }, [currentApp]);

  useEffect((): void => {
    (async (): Promise<void> => {
      console.log('start loading app: ', currentAppId);
      setCurrentApp(await loadApp(currentAppId));
      setDirty(false);
    })();
  }, [currentAppId]);

  const onAppWillChange = (): boolean => {
    if (dirty) {
      return confirm('Unsaved changes will be lost')
    }
    return true;
  };
  const onAppChanged = (appId: AppId): void => {
    setCurrentAppId(appId);
  };

  const onSceneLoaded = (): void => {
    setSceneLoading(false);
  };

  return (<Fragment>
    <Header examples={EXAMPLES} currentApp={currentAppId} sceneLoading={sceneLoading}
      onAppWillStart={compileAndRunCurrentApp}
      onAppWillChange={onAppWillChange}
      onAppChanged={onAppChanged} />
    <div class={style.home}>
      <div class={style.bodyContainer}>
        <div class={style.canvas}><Canvas scene={renderScene} onSceneLoaded={onSceneLoaded} /></div>
        <div class={style.editor}><Editor app={currentApp} monaco={monaco} onDirtyChange={(d): void => { setDirty(d); }} /></div>
      </div>
    </div>
  </Fragment>);
};

export default HomeWrap;
