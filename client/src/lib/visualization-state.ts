/**
 * Visualization state management for floor plan rendering
 * Handles transitions between base view (empty floor plan) and detailed view (with îlots and corridors)
 */

import { useReducer, useCallback } from 'react';

export type VisualizationMode = 'base' | 'detailed';

export interface VisualizationOptions {
  mode: VisualizationMode;
  showWalls: boolean;
  showRestricted: boolean;
  showEntrances: boolean;
  showIlots: boolean;
  showCorridors: boolean;
  showMeasurements: boolean;
  showGrid: boolean;
}

export interface VisualizationState {
  options: VisualizationOptions;
}

const DEFAULT_OPTIONS: VisualizationOptions = {
  mode: 'base',
  showWalls: true,
  showRestricted: true,
  showEntrances: true,
  showIlots: false,
  showCorridors: false,
  showMeasurements: true,
  showGrid: true
};

type VisualizationAction =
  | { type: 'SET_MODE'; payload: VisualizationMode }
  | { type: 'SET_OPTION'; payload: { key: keyof Omit<VisualizationOptions, 'mode'>; value: boolean } }
  | { type: 'RESET_TO_DEFAULTS' };

function visualizationReducer(state: VisualizationState, action: VisualizationAction): VisualizationState {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        options: {
          ...state.options,
          mode: action.payload,
          showIlots: action.payload === 'detailed',
          showCorridors: action.payload === 'detailed',
        },
      };
    case 'SET_OPTION':
      return {
        ...state,
        options: {
          ...state.options,
          [action.payload.key]: action.payload.value,
        },
      };
    case 'RESET_TO_DEFAULTS':
      return {
        ...state,
        options: {
          ...DEFAULT_OPTIONS,
          mode: state.options.mode,
        },
      };
    default:
      return state;
  }
}

export function useVisualizationState(initialMode: VisualizationMode = 'base') {
  const [state, dispatch] = useReducer(visualizationReducer, {
    options: {
      ...DEFAULT_OPTIONS,
      mode: initialMode,
      showIlots: initialMode === 'detailed',
      showCorridors: initialMode === 'detailed',
    },
  });

  const setMode = useCallback((mode: VisualizationMode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  const setVisualizationOption = useCallback(
    (key: keyof Omit<VisualizationOptions, 'mode'>, value: boolean) => {
      dispatch({ type: 'SET_OPTION', payload: { key, value } });
    },
    []
  );

  return { state: state.options, setMode, setVisualizationOption };
}
