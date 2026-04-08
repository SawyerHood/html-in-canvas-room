// Form validation logic and state management

const validators = {
  username(value) {
    if (!value.length) return { valid: false, message: '' };
    if (value.length < 3) return { valid: false, message: 'Must be at least 3 characters' };
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return { valid: false, message: 'Letters, numbers, and underscores only' };
    return { valid: true, message: 'Looks good!' };
  },
  email(value) {
    if (!value.length) return { valid: false, message: '' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { valid: false, message: 'Enter a valid email address' };
    return { valid: true, message: 'Valid email!' };
  },
  password(value) {
    if (!value.length) return { valid: false, message: '' };
    if (value.length < 8) return { valid: false, message: 'At least 8 characters' };
    if (!/[A-Z]/.test(value)) return { valid: false, message: 'Include an uppercase letter' };
    if (!/[0-9]/.test(value)) return { valid: false, message: 'Include a number' };
    if (!/[^a-zA-Z0-9]/.test(value)) return { valid: false, message: 'Include a special character' };
    return { valid: true, message: 'Strong password!' };
  },
  confirm(value) {
    if (!value.length) return { valid: false, message: '' };
    const pw = document.getElementById('password').value;
    if (value !== pw) return { valid: false, message: 'Passwords do not match' };
    return { valid: true, message: 'Passwords match!' };
  },
};

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Track per-field touch state
const fieldMeta = {};

export function initValidation(onStateChange) {
  const fieldNames = ['username', 'email', 'password', 'confirm'];

  for (const name of fieldNames) {
    fieldMeta[name] = { touched: false };
    const input = document.getElementById(name);

    input.addEventListener('focus', () => {
      onStateChange(name, 'focused');
    });

    input.addEventListener('blur', () => {
      if (!fieldMeta[name].touched && !input.value.length) {
        onStateChange(name, 'untouched');
        return;
      }
      fieldMeta[name].touched = true;
      runValidation(name, onStateChange);
    });

    const debouncedValidate = debounce(() => {
      if (!fieldMeta[name].touched && !input.value.length) return;
      fieldMeta[name].touched = true;
      runValidation(name, onStateChange);
    }, 300);

    input.addEventListener('input', debouncedValidate);
  }

  // Submit button
  const btn = document.getElementById('submit-btn');
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    // Validate all fields
    let allValid = true;
    for (const name of fieldNames) {
      fieldMeta[name].touched = true;
      const result = runValidation(name, onStateChange);
      if (!result.valid) allValid = false;
    }
    if (allValid) {
      onStateChange('submit', 'valid');
    }
  });

  // Also re-validate confirm when password changes
  document.getElementById('password').addEventListener('input', () => {
    if (fieldMeta.confirm.touched) {
      setTimeout(() => runValidation('confirm', onStateChange), 310);
    }
  });
}

function runValidation(name, onStateChange) {
  const input = document.getElementById(name);
  const msg = document.getElementById(`${name}-msg`);
  const result = validators[name](input.value);

  msg.textContent = result.message;
  if (result.valid) {
    msg.classList.add('valid');
    msg.classList.remove('invalid');
  } else {
    msg.classList.remove('valid');
    if (result.message) msg.classList.add('invalid');
  }

  if (!input.value.length && !fieldMeta[name].touched) {
    onStateChange(name, 'untouched');
  } else if (result.valid) {
    onStateChange(name, 'valid');
  } else if (result.message) {
    onStateChange(name, 'invalid');
  }

  // Update submit button state
  updateSubmitState(onStateChange);

  return result;
}

function updateSubmitState(onStateChange) {
  const allValid = ['username', 'email', 'password', 'confirm'].every((name) => {
    const result = validators[name](document.getElementById(name).value);
    return result.valid;
  });
  onStateChange('submit', allValid ? 'valid' : 'untouched');
}
