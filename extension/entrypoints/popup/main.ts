import type {
  ToContentMessage,
  ShaderState,
  ShaderEffect,
} from '@/utils/messages';

const toggle = document.getElementById('toggle') as HTMLInputElement;
const intensitySlider = document.getElementById('intensity') as HTMLInputElement;
const speedSlider = document.getElementById('speed') as HTMLInputElement;
const intensityVal = document.getElementById('intensity-val')!;
const speedVal = document.getElementById('speed-val')!;
const shaderBtns =
  document.querySelectorAll<HTMLButtonElement>('.shader-btn');

let currentShader: ShaderEffect = 'crt';

async function getTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab;
}

async function send(msg: ToContentMessage): Promise<ShaderState | undefined> {
  const tab = await getTab();
  if (!tab.id) return;
  try {
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    // Content script not injected on this page
  }
}

// Initialize popup from content script state
(async () => {
  const state = await send({ type: 'getState' });
  if (state) {
    toggle.checked = state.active;
    currentShader = state.shader;
    intensitySlider.value = String(state.intensity * 100);
    speedSlider.value = String(state.speed * 100);
    intensityVal.textContent = Math.round(state.intensity * 100) + '%';
    speedVal.textContent = Math.round(state.speed * 100) + '%';
    shaderBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.shader === currentShader);
    });
  }
})();

toggle.addEventListener('change', () => {
  send({ type: 'toggle', enabled: toggle.checked, shader: currentShader });
});

shaderBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    shaderBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentShader = btn.dataset.shader as ShaderEffect;
    send({ type: 'setShader', shader: currentShader });
    if (!toggle.checked) {
      toggle.checked = true;
      send({ type: 'toggle', enabled: true, shader: currentShader });
    }
  });
});

intensitySlider.addEventListener('input', () => {
  const v = Number(intensitySlider.value) / 100;
  intensityVal.textContent = intensitySlider.value + '%';
  send({ type: 'setIntensity', intensity: v });
});

speedSlider.addEventListener('input', () => {
  const v = Number(speedSlider.value) / 100;
  speedVal.textContent = speedSlider.value + '%';
  send({ type: 'setSpeed', speed: v });
});
