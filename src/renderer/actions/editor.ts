import { ActionsUnion } from '../utils/actionsUnion';
import { ThunkDispatch } from 'redux-thunk';
import { RootState } from '../reducers';
import { performRequest } from '../thrift/performRequest';
import { activeTabIdSelector, endpointSelector, requestSelector, selectedMethodSelector } from '../selectors/editor';
import {
    methodDefaultRequestSelector,
    servicesStateSelector
} from '../selectors/services';
import { requestProxySelector, requestTimeoutSelector } from '../selectors/settings';
import { saveEndpointHistory } from './settings';
import { savedEntriesSelector } from '../selectors/savedRequests';

export const CREATE_TAB = '@editor/createTab';
export const CLOSE_TAB = '@editor/closeTab';
export const SELECT_TAB = '@editor/selectTab';
export const SELECT_SERVICE_AND_METHOD = '@editor/selectServiceAndMethod';
export const SET_ENDPOINT = '@editor/setEndpoint';
export const SET_REQUEST = '@editor/setRequest';
export const SUBMIT_REQUEST = '@editor/submitRequest';
export const SUBMIT_REQUEST_ERROR = '@editor/submitRequestError';
export const SUBMIT_REQUEST_SUCCESS = '@editor/submitRequestSuccess';

const editorAC = {
    createTab() {
        return {
            type: CREATE_TAB
        } as const;
    },
    closeTab(tabId: string) {
        return {
            type: CLOSE_TAB,
            tabId
        } as const;
    },
    selectTab(tabId: string) {
        return {
            type: SELECT_TAB,
            tabId
        } as const;
    },
    selectServiceAndMethod(serviceName: string, methodName: string) {
        return {
            type: SELECT_SERVICE_AND_METHOD,
            serviceName,
            methodName
        } as const;
    },
    setEndpoint(value: string) {
        return {
            type: SET_ENDPOINT,
            value
        } as const;
    },
    setRequest(value: string) {
        return {
            type: SET_REQUEST,
            value
        } as const;
    },
    submitRequest(serviceName: string, methodName: string, endpoint: string, request: string) {
        return {
            type: SUBMIT_REQUEST,
            serviceName,
            methodName,
            endpoint,
            request
        } as const;
    },
    submitRequestError(error: Error) {
        return {
            type: SUBMIT_REQUEST_ERROR,
            error
        } as const;
    },
    submitRequestSuccess(response: string) {
        return {
            type: SUBMIT_REQUEST_SUCCESS,
            response
        } as const;
    },
};

export type EditorActions = ActionsUnion<typeof editorAC>;

export const selectTab = editorAC.selectTab;
export const createTab = editorAC.createTab;
export function closeTab(tabId?: string) {
    return (dispatch: ThunkDispatch<RootState, {}, any>, getState: () => RootState) => {
        if (!tabId) {
            // tslint:disable-next-line:no-parameter-reassignment
            tabId = activeTabIdSelector(getState());
        }

        dispatch(editorAC.closeTab(tabId));
    }
}

export function selectServiceAndMethod(serviceName: string, methodName: string) {
    return (dispatch: ThunkDispatch<RootState, {}, any>, getState: () => RootState) => {
        dispatch(editorAC.selectServiceAndMethod(serviceName, methodName));
        const state = getState();
        const defaultRequest = methodDefaultRequestSelector(state, serviceName, methodName);
        const endpoint = endpointSelector(state);

        if (endpoint) {
            dispatch(saveEndpointHistory(endpoint, serviceName));
        }

        dispatch(editorAC.setRequest(defaultRequest));
    };
}
export const setEndpoint = editorAC.setEndpoint;
export const setRequest = editorAC.setRequest;

export function submitRequest() {
    return async (dispatch: ThunkDispatch<RootState, {}, any>, getState: () => RootState) => {
        const state = getState();
        const method = selectedMethodSelector(state);
        const requestMessage = requestSelector(state);
        const endpoint = endpointSelector(state);
        const timeout = requestTimeoutSelector(state);
        const proxy = requestProxySelector(state);

        if (!method) {
            return dispatch(editorAC.submitRequestError(new Error('Select method')));
        }

        dispatch(editorAC.submitRequest(method.serviceName, method.methodName, endpoint, requestMessage));

        try {
            const servicesState = servicesStateSelector(state);
            const executor = servicesState.services[method.serviceName][method.methodName];

            const result = await performRequest({
                method: executor,
                endpoint,
                requestMessage,
                timeout,
                proxy
            });
            dispatch(editorAC.submitRequestSuccess(result));
            dispatch(saveEndpointHistory(endpoint, method.serviceName));
        } catch (error) {
            dispatch(editorAC.submitRequestError(error));
        }
    }
}

export function loadSavedRequest(id: string) {
    return (dispatch: ThunkDispatch<RootState, {}, any>, getState: () => RootState) => {
        const state = getState();
        const entry = savedEntriesSelector(state)[id];

        if (!entry) {
            return;
        }

        dispatch(editorAC.createTab());
        dispatch(editorAC.setEndpoint(entry.endpoint));
        dispatch(editorAC.selectServiceAndMethod(entry.serviceName, entry.methodName));
        dispatch(editorAC.setRequest(entry.request));
    }
}
