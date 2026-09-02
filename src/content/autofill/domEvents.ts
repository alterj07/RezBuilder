/**
 * DOM event dispatching and native value setter utilities.
 * Ensures React, Vue, Angular, and vanilla DOM state bindings update correctly
 * by invoking prototype descriptor setters and dispatching full synthetic event sequences.
 */

export function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
): void {
  let prototype = Object.getPrototypeOf(element);
  let descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(prototype, 'value');

  while (prototype && (!descriptor || !descriptor.set)) {
    prototype = Object.getPrototypeOf(prototype);
    if (prototype) {
      descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    }
  }

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }

  // React fiber value tracker update
  const tracker = (element as any)._valueTracker;
  if (tracker && typeof tracker.setValue === 'function') {
    tracker.setValue(value);
  }

  dispatchSyntheticEvents(element, ['focus', 'input', 'change', 'blur']);
}

export function setNativeChecked(element: HTMLInputElement, checked: boolean): void {
  let prototype = Object.getPrototypeOf(element);
  let descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(prototype, 'checked');

  while (prototype && (!descriptor || !descriptor.set)) {
    prototype = Object.getPrototypeOf(prototype);
    if (prototype) {
      descriptor = Object.getOwnPropertyDescriptor(prototype, 'checked');
    }
  }

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, checked);
  } else {
    element.checked = checked;
  }

  dispatchSyntheticEvents(element, ['focus', 'click', 'input', 'change', 'blur']);
}

export function setSelectOption(element: HTMLSelectElement, valueOrText: string): boolean {
  if (!element || !element.options) return false;

  const target = valueOrText.toLowerCase().trim();
  let matchedIndex = -1;

  // Pass 1: Exact Match
  for (let i = 0; i < element.options.length; i++) {
    const opt = element.options[i];
    const optVal = opt.value.toLowerCase().trim();
    const optText = (opt.textContent || '').toLowerCase().trim();

    if (optVal === target || optText === target) {
      matchedIndex = i;
      break;
    }
  }

  // Pass 2: Substring Match fallback
  if (matchedIndex === -1) {
    for (let i = 0; i < element.options.length; i++) {
      const opt = element.options[i];
      const optVal = opt.value.toLowerCase().trim();
      const optText = (opt.textContent || '').toLowerCase().trim();

      if (optVal.includes(target) || optText.includes(target)) {
        matchedIndex = i;
        break;
      }
    }
  }

  if (matchedIndex !== -1) {
    element.selectedIndex = matchedIndex;
    let prototype = Object.getPrototypeOf(element);
    let descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, element.options[matchedIndex].value);
    }
    dispatchSyntheticEvents(element, ['focus', 'change', 'input', 'blur']);
    return true;
  }

  return false;
}

export function dispatchSyntheticEvents(
  element: HTMLElement,
  events: string[] = ['focus', 'input', 'change', 'blur']
): void {
  for (const eventName of events) {
    let evt: Event;
    if (eventName === 'input' && typeof InputEvent !== 'undefined') {
      try {
        evt = new InputEvent('input', { bubbles: true, cancelable: true });
      } catch {
        evt = new Event('input', { bubbles: true, cancelable: true });
      }
    } else if ((eventName === 'focus' || eventName === 'blur') && typeof FocusEvent !== 'undefined') {
      try {
        evt = new FocusEvent(eventName, { bubbles: true, cancelable: true });
      } catch {
        evt = new Event(eventName, { bubbles: true, cancelable: true });
      }
    } else {
      evt = new Event(eventName, { bubbles: true, cancelable: true });
    }

    element.dispatchEvent(evt);
  }
}
