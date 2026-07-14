export let branchesList = [];
export let outletsList = [];
export let posOutletsList = []; // Outlets accessible by current POS user
export let activeOutletId = null;

export function setBranchesList(list) {
    branchesList = list;
}

export function setOutletsList(list) {
    outletsList = list;
}

export function setPosOutletsList(list) {
    posOutletsList = list;
}

export function setActiveOutletId(id) {
    activeOutletId = id;
}

export function getActiveOutletId() {
    return activeOutletId;
}

export function getPosOutletsList() {
    return posOutletsList;
}

export function getBranchesList() {
    return branchesList;
}

export function getOutletsList() {
    return outletsList;
}
