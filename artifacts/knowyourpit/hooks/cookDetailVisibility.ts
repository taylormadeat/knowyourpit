let _cookDetailScreenVisible = false;

export function setCookDetailVisible(visible: boolean): void {
  _cookDetailScreenVisible = visible;
}

export function isCookDetailVisible(): boolean {
  return _cookDetailScreenVisible;
}
