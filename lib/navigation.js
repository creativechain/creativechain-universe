let lastNavItem;
let lastNavItemLi;

let lastBody;
let lastBodyContent;
let lastBoxFilter;

let lastProfileContent;

function setBodyClass(classes) {
    $('#body').attr('class', classes);
}

function changeNavItem(newId) {

    if (lastNavItemLi) {
        lastNavItemLi.removeClass('active-li');
    }

    if (lastNavItem) {
        lastNavItem.removeClass('active-a');
    }

    lastNavItem = $(newId);
    lastNavItem.addClass('active-a');

    lastNavItemLi = $(newId + '-li');
    lastNavItemLi.addClass('active-li');

}

function changeBody(newId) {
    if (lastBody) {
        lastBody.css('display', 'none');
    }

    lastBody = undefined;
    if (newId) {
        lastBody = $(newId).css('display', 'inherit');
    }
}

function changeBodyContent(newId) {
    if (lastBodyContent) {
        lastBodyContent.css('display', 'none');
    }

    lastBodyContent = $(newId);
    lastBodyContent.removeAttr('style');
    lastBodyContent.css('display', 'inherit');
}

function changeBoxFilter(newId) {
    if (lastBoxFilter) {
        lastBoxFilter.css('display', 'none');
    }

    lastBoxFilter = $(newId);
    lastBoxFilter.css('display', 'inherit');
}

function changeProfileContent(newId) {
    if (lastProfileContent) {
        lastProfileContent.css('display', 'none');
    }

    lastProfileContent = $(newId);
    lastProfileContent.css('display', 'inherit');
}

function showExploreView() {
    setBodyClass('page-dashboard');
    changeBody('#ui-body');
    changeNavItem('#nav-explore');
    changeBoxFilter('#ui-main-filter');
    changeBodyContent('#ui-posts');
    return false;
}

function showWalletView() {
    setBodyClass('page-wallet');
    changeBody('#ui-body');
    changeNavItem('#nav-wallet');
    changeBoxFilter('#ui-wallet-filter');
    changeBodyContent('#ui-wallet');
    return false;
}

function prepareProfile() {
    setBodyClass('page-profile');
    changeBody('#ui-body-profile');
    changeBoxFilter('#ui-profile-filter');
}

function showProfileView() {
    prepareProfile();
    changeProfileContent('#ui-profile-posts');

    return false;
}

function showProfileEditView() {
    prepareProfile();
    setBodyClass('page-profile edit-profile');
    changeProfileContent('#ui-profile-edit');

    return false;
}

showExploreView();