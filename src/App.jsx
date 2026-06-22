import { useState, useCallback, useRef } from 'react';
import Toolbar from './components/Toolbar';
import LayersPanel from './components/LayersPanel';
import Canvas from './components/Canvas';
import Inspector from './components/Inspector';
import Dashboard from './components/Dashboard';

const MIN_INSPECTOR = 220;
const MAX_INSPECTOR = 560;

export default function App() {
  const [screen, setScreen] = useState('dashboard');
  const [currentDesignName, setCurrentDesignName] = useState('');
  const [inspectorW, setInspectorW] = useState(280);
  const dragStart = useRef(null);

  const goToDashboard = useCallback(() => setScreen('dashboard'), []);

  const openEditor = useCallback((name = '') => {
    setCurrentDesignName(name);
    setScreen('editor');
  }, []);

  const onResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, w: inspectorW };
    const onMove = (me) => {
      const delta = dragStart.current.x - me.clientX;
      const next = Math.min(MAX_INSPECTOR, Math.max(MIN_INSPECTOR, dragStart.current.w + delta));
      setInspectorW(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [inspectorW]);

  if (screen === 'dashboard') {
    return (
      <Dashboard
        onEdit={(name) => openEditor(name)}
        onNew={() => openEditor('')}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Toolbar
        currentDesignName={currentDesignName}
        setCurrentDesignName={setCurrentDesignName}
        onBack={goToDashboard}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid #374151', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <LayersPanel />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Canvas />
        </div>
        <div
          onMouseDown={onResizeMouseDown}
          style={{ width: 5, flexShrink: 0, background: 'transparent', borderLeft: '1px solid #374151', cursor: 'col-resize', position: 'relative', zIndex: 10 }}
          title="Drag to resize panel"
        >
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#4b5563' }} />
            ))}
          </div>
        </div>
        <div style={{ width: inspectorW, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Inspector />
        </div>
      </div>
    </div>
  );
}
