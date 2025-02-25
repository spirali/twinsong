import { ActionDispatch, createContext, useContext, useReducer } from "react";
import { INITIAL_STATE, State, StateAction, stateReducer } from "../core/state";
import { JSX } from "react";

const StateContext = createContext<State>(INITIAL_STATE);
const DispatchContext = createContext<ActionDispatch<
  [action: StateAction]
> | null>(null);

export const StateProvider = (props: { children: JSX.Element }) => {
  const [tasks, dispatch] = useReducer(stateReducer, INITIAL_STATE);

  return (
    <StateContext.Provider value={tasks}>
      <DispatchContext.Provider value={dispatch}>
        {props.children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
};

export function useGlobalState(): State {
  return useContext(StateContext);
}

export function useDispatch() {
  return useContext(DispatchContext);
}
