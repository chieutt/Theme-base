(() => {
  const cursorOwners = new Map();

  document.addEventListener('click', (event) => {
    const handle = event.target instanceof Element ? event.target.closest('.quick-view__handle') : null;
    if (!handle) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  class ModalBackdropPointer {
    constructor({ root, panel, pointer, isOpen, cursorClass = 'modal-backdrop-cursor', pointerX = '--modal-backdrop-pointer-x', pointerY = '--modal-backdrop-pointer-y', relativeToRoot = false, isDisabled = () => false }) {
      this.root = root;
      this.panel = panel;
      this.pointer = pointer;
      this.isOpen = isOpen;
      this.cursorClass = cursorClass;
      this.pointerX = pointerX;
      this.pointerY = pointerY;
      this.relativeToRoot = relativeToRoot;
      this.isDisabled = isDisabled;
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onPointerLeaveViewport = this.hide.bind(this);
      this.onViewportMouseOut = this.onViewportMouseOut.bind(this);
      document.addEventListener('mousemove', this.onMouseMove, { passive: true });
      document.addEventListener('mouseleave', this.onPointerLeaveViewport);
      window.addEventListener('mouseout', this.onViewportMouseOut);
      window.addEventListener('blur', this.onPointerLeaveViewport);
    }

    onMouseMove(event) {
      if (!this.isOpen?.() || this.isDisabled?.() || !this.panel) {
        this.hide();
        return;
      }
      const panelRect = this.panel.getBoundingClientRect();
      const overBackdrop = event.clientX < panelRect.left || event.clientX > panelRect.right || event.clientY < panelRect.top || event.clientY > panelRect.bottom;
      if (!overBackdrop) {
        this.hide();
        return;
      }
      let owners = cursorOwners.get(this.cursorClass);
      if (!owners) {
        owners = new Set();
        cursorOwners.set(this.cursorClass, owners);
      }
      owners.add(this);
      document.documentElement.classList.add(this.cursorClass);
      if (!this.pointer) return;
      const rootRect = this.relativeToRoot ? this.root?.getBoundingClientRect() : null;
      this.pointer.style.setProperty(this.pointerX, `${event.clientX - (rootRect?.left || 0)}px`);
      this.pointer.style.setProperty(this.pointerY, `${event.clientY - (rootRect?.top || 0)}px`);
      this.pointer.classList.add('is-visible');
    }

    onViewportMouseOut(event) {
      if (!event.relatedTarget) this.hide();
    }

    hide() {
      const owners = cursorOwners.get(this.cursorClass);
      owners?.delete(this);
      if (!owners?.size) {
        cursorOwners.delete(this.cursorClass);
        document.documentElement.classList.remove(this.cursorClass);
      }
      this.pointer?.classList.remove('is-visible');
    }

    destroy() {
      document.removeEventListener('mousemove', this.onMouseMove);
      document.removeEventListener('mouseleave', this.onPointerLeaveViewport);
      window.removeEventListener('mouseout', this.onViewportMouseOut);
      window.removeEventListener('blur', this.onPointerLeaveViewport);
      this.hide();
    }
  }

  window.SpinelModalBackdropPointer = ModalBackdropPointer;
})();
