import { Fragment, FunctionalComponent, h } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { AppInfo, FileInfo } from "../../rt_app_info";
import MonacoEditor, { Monaco } from "@monaco-editor/react";
import style from './style.css';

interface Tab {
  lang: 'json' | 'glsl';
  file: FileInfo;
  dirty: boolean;
}

interface TabWrap {
  tab?: Tab;
}

const SHADER_STAGE_FILE_EXTS = [
  '.rgen',
  '.rmiss',
  '.rint',
  '.rchit',
  '.rahit',
];

type SourceTabsProps = {
  tabs: Tab[];
  currentTab?: TabWrap;
  onTabChanged: (tab: Tab) => void;
};
const SourceTabs: FunctionalComponent<SourceTabsProps> = ({ tabs, currentTab, onTabChanged }) => {
  return (<div>
    {
      tabs.map(t => (
        <span key={t.file.path}
          class={`${style.tabButton} ${t === currentTab?.tab ? style.activeTab : ''}`}
          onClick={(): void => { onTabChanged(t); }}>
          {(t.dirty ? '*' : '') + t.file.filename}
        </span>
      ))
    }
    {/* <button>+</button> */}
  </div>);
};

type EditorProps = {
  app: AppInfo | null;
  onDirtyChange: (dirty: boolean) => void;
  monaco: Monaco | null;
};
const Editor: FunctionalComponent<EditorProps> = ({ app, onDirtyChange, monaco }) => {
  const [currentTab, setCurrentTab] = useState<TabWrap>({});

  const tabs = useMemo(() => {
    if (monaco) {
      for (const m of monaco.editor.getModels()) {
        m.dispose();
      }
    }
    const tabs: Tab[] = [];
    if (!app) {
      setCurrentTab({});
      return [];
    }
    const sceneTab = {
      name: 'Scene.json',
      lang: 'json' as const,
      sourceCode: app.sceneConfig,
      file: app.sceneConfig,
      dirty: false
    };
    tabs.push(sceneTab);
    if (app.commonCode !== undefined) {
      tabs.push({
        lang: 'glsl',
        file: app.commonCode,
        dirty: false,
      })
    }
    tabs.push(...app.shaders.map(s => ({
      lang: 'glsl',
      file: s,
      dirty: false,
    }) as Tab));
    setCurrentTab({ tab: sceneTab });
    return tabs;
  }, [app]);

  const onTabChanged = (t: Tab): void => {
    setCurrentTab({ tab: t });
  };

  if (!currentTab.tab || !tabs.includes(currentTab.tab /* stale */)) {
    return <div>'loading...'</div>;
  }
  // console.log('current tab path', `${currentTab.tab?.file.path || ''}`, 'source: "', (currentTab.tab?.file.code || '').slice(0, 10), '"');
  return (<div>
    <Fragment>
      <SourceTabs tabs={tabs} currentTab={currentTab} onTabChanged={onTabChanged} />
      <MonacoEditor
        height='80vh'
        theme='vs-dark'
        path={currentTab.tab.file.path}
        defaultLanguage={currentTab.tab.lang || 'c'}
        defaultValue={currentTab.tab.file.code} // TODO: discard original sourcecode after model created?
        options={{ fontSize: 15 }}
        onChange={(value, ev): void => {
          if (currentTab.tab && !currentTab.tab.dirty) {
            currentTab.tab.dirty = true;
            setCurrentTab({ tab: currentTab.tab }); // force-update
            onDirtyChange(true);
            console.log('changed', ev);
          }
        }}
      />
    </Fragment>
  </div>);

};

export default Editor;