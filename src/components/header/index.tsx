import { FunctionalComponent, h } from 'preact';
import { useState } from 'preact/hooks';
import { AppId } from '../../rt_app_info';
import style from './style.css';
// import playButton from '../../assets/start-button.svg';

type HeaderProps = {
  examples: AppId[];
  currentApp: AppId;
  sceneLoading: boolean;
  onAppChanged: (app: AppId) => void;
  onAppWillChange: (app: AppId) => boolean;
  onAppWillStart: () => void;
}

const Header: FunctionalComponent<HeaderProps> = ({ examples, currentApp, sceneLoading, onAppWillStart, onAppWillChange, onAppChanged }) => {
  const [showExamplesList, setShowExamplesList] = useState(false);
  return (
    <header class={style.header}>
      <h1>Shadowray Playground</h1>
      <nav>
        <div id={style.centerActionContainer}>
          {
            sceneLoading ? 'Compiling...' :
              <a id={style.startButton} onClick={onAppWillStart} title='Re-compile & run'><img src='/assets/start-button.svg' /></a>
          }
        </div>
        <a class={style.active} href="#">
          {currentApp.name}
        </a>
        <a class={style.dropdownSelect} href="#"
          onMouseEnter={(): void => { setShowExamplesList(true); }}
          onMouseLeave={(): void => { setShowExamplesList(false); }}
        >
          More examples
          <ul class={style.dropdownList} >
            {showExamplesList ?
              examples.map(app => (
                <li key={app.id}
                  class={app === currentApp ? style.active : ''}
                  onClick={(): void => {
                    setShowExamplesList(false);
                    if (onAppWillChange(app)) {
                      onAppChanged(app);
                    }
                  }}
                >
                  <a>
                    {
                      app.name
                    }
                  </a>
                </li>
              )) : null
            }
          </ul>
        </a>
      </nav>
    </header>
  );
};

export default Header;
