let _cookDetailScreenVisible = false;
let _currentCookId: number | null = null;

export function setCookDetailVisible(visible: boolean): void {
  _cookDetailScreenVisible = visible;
}

export function isCookDetailVisible(): boolean {
  return _cookDetailScreenVisible;
}

export function setCurrentCookId(cookId: number | null): void {
  _currentCookId = cookId;
}

export function getCurrentCookId(): number | null {
  return _currentCookId;
}
