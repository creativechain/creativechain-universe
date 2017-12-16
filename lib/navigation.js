let lastNavItem;
let lastNavItemLi;

let lastBodyContent;
let lastBoxFilter;

let lastProfileContent;

let lastSidebar;

function setBodyClass(classes) {
    $('#body').attr('class', classes);
}

function changeUIBodyClass(clazz, add) {
    if (add) {
        $('#ui-body').addClass(clazz);
    } else {
        $('#ui-body').removeClass(clazz);
    }
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

function changeBodyContent(newId) {
    if (lastBodyContent) {
        lastBodyContent.css('display', 'none');
    }

    lastBodyContent = $(newId);
    lastBodyContent.removeAttr('style');
    lastBodyContent.css('display', 'inherit');
}

function changeSidebar(newId) {
    if (lastSidebar) {
        lastSidebar.css('display', 'none');
    }

    lastSidebar = $(newId);
    lastSidebar.css('display', 'inherit');
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

function prepareMain() {
    setBodyClass('page-dashboard');
    changeSidebar('#main-sidebar');
    changeUIBodyClass('profile', false);
    $('#main-content').css('display', 'inherit');
    $('#ui-profile-posts').css('display', 'none');
    $('#ui-profile-edit').css('display', 'none');
}

function prepareProfile() {
    setBodyClass('page-profile');
    changeBoxFilter('#ui-profile-filter');
    changeSidebar('#profile-sidebar');
    changeUIBodyClass('profile', true);
    $('#main-content').css('display', 'none');
}

function showExploreView() {
    prepareMain();
    changeNavItem('#nav-explore');
    changeBoxFilter('#ui-main-filter');
    changeBodyContent('#ui-posts');
    return false;
}

function showWalletView() {
    prepareMain();
    setBodyClass('page-wallet');
    changeNavItem('#nav-wallet');
    changeBoxFilter('#ui-wallet-filter');
    changeBodyContent('#ui-wallet');
    return false;
}

function showSettings() {
    prepareMain();
    setBodyClass('page-profile edit-profile');
    changeNavItem('#nav-explore');
    changeBoxFilter('#ui-main-filter');
    changeBodyContent('#ui-settings');
    return false;
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

function showNotificationsView() {
    $('#notifications-num').html(0);
    return false;
}
showExploreView();