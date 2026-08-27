import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UI_MODE_HYDRATION_TIMEOUT_MS,
  UIModeProvider,
  useUIMode,
} from '../../contexts/UIModeContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

const TestComponent = () => {
  const { mode, setMode } = useUIMode();
  return (
    <>
      <Text testID="mode-text">{mode}</Text>
      <TouchableOpacity testID="btn-preview" onPress={() => setMode('preview')} />
      <TouchableOpacity testID="btn-legacy" onPress={() => setMode('legacy')} />
    </>
  );
};

describe('UIModeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hydrates legacy by default', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const { getByTestId } = render(
      <UIModeProvider>
        <TestComponent />
      </UIModeProvider>
    );

    await waitFor(() => {
      expect(getByTestId('mode-text').props.children).toBe('legacy');
    });
  });

  it('hydrates preview from storage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('preview');
    const { getByTestId } = render(
      <UIModeProvider>
        <TestComponent />
      </UIModeProvider>
    );

    await waitFor(() => {
      expect(getByTestId('mode-text').props.children).toBe('preview');
    });
  });

  it('changes mode and saves to storage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('legacy');
    const { getByTestId } = render(
      <UIModeProvider>
        <TestComponent />
      </UIModeProvider>
    );

    await waitFor(() => {
      expect(getByTestId('mode-text').props.children).toBe('legacy');
    });

    fireEvent.press(getByTestId('btn-preview'));
    expect(getByTestId('mode-text').props.children).toBe('preview');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('knowyourpit:ui_mode', 'preview');
  });

  it('falls back to legacy if storage hydration stalls', async () => {
    jest.useFakeTimers();
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    const { getByTestId, queryByTestId } = render(
      <UIModeProvider>
        <TestComponent />
      </UIModeProvider>
    );

    expect(queryByTestId('mode-text')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(UI_MODE_HYDRATION_TIMEOUT_MS);
    });

    expect(getByTestId('mode-text').props.children).toBe('legacy');
  });

  it('falls back to legacy if storage hydration rejects', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error('storage unavailable'),
    );

    const { getByTestId } = render(
      <UIModeProvider>
        <TestComponent />
      </UIModeProvider>
    );

    await waitFor(() => {
      expect(getByTestId('mode-text').props.children).toBe('legacy');
    });
  });
});
