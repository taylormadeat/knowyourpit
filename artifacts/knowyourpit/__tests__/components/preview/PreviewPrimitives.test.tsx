import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PreviewSurface, PreviewSectionHeader, PreviewAction, PreviewEmptyState } from '@/components/preview/PreviewPrimitives';
import { useColors } from '@/hooks/useColors';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Feather: (props: Record<string, unknown>) => React.createElement(View, props),
  };
});

const mockColors = {
  card: '#ffffff',
  border: '#dddddd',
  primary: '#ff0000',
  primaryForeground: '#ffffff',
  destructive: '#ff0000',
  destructiveForeground: '#ffffff',
  foreground: '#000000',
  mutedForeground: '#666666',
  accent: '#eeeeee',
} as ReturnType<typeof useColors>;

describe('PreviewPrimitives', () => {
  it('renders PreviewSurface correctly', () => {
    const { getByTestId } = render(
      <PreviewSurface colors={mockColors} testID="surface">
        <></>
      </PreviewSurface>
    );
    const element = getByTestId('surface');
    expect(element.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: mockColors.card, borderRadius: 16 })
      ])
    );
  });

  it('renders PreviewSectionHeader correctly', () => {
    const { getByTestId } = render(
      <PreviewSectionHeader colors={mockColors} title="Test Header" testID="section-header" />
    );
    expect(getByTestId('section-header').props.children).toBe('Test Header');
  });

  it('renders PreviewAction and handles press', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <PreviewAction colors={mockColors} title="Click Me" onPress={onPress} />
    );
    
    const button = getByRole('button');
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalled();
    expect(button.props.accessibilityLabel).toBe('Click Me');
  });

  it('renders PreviewEmptyState correctly', () => {
    const { getByTestId } = render(
      <PreviewEmptyState
        colors={mockColors}
        title="Empty"
        description="Nothing here"
        icon="box"
        testID="empty-state"
      />
    );
    expect(getByTestId('empty-state').props.children.filter(Boolean)).toHaveLength(3);
  });
});
