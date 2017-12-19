let lastBodyContent;
let lastBoxFilter;
let lastProfileContent;
let lastSidebar;
let lastActiveBoxFilter;
let lastTabPanel;

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

function changeFollowingContainerClasses(classes, add = false) {
    let container = $('#ui-following-container');
    if (add) {
        classes.forEach(function (clazz) {
            container.addClass(clazz);
        })
    } else {
        classes.forEach(function (clazz) {
            container.removeClass(clazz);
        })
    }
}

function setActiveBoxFilter(newId) {
    if (lastActiveBoxFilter) {
        lastActiveBoxFilter.removeClass('active');
    }

    lastActiveBoxFilter = $(newId);
    lastActiveBoxFilter.addClass('active');
}

function setLastTabPanel(newId) {
    if (lastTabPanel) {
        lastTabPanel.addClass('hidden');
    }

    lastTabPanel = $(newId);
    lastTabPanel.removeClass('hidden');
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
    changeFollowingContainerClasses(['col-md-2'], false);
    changeFollowingContainerClasses(['col-md-3', 'col-lg-2'], true);
    $('#main-content').css('display', 'inherit');
    $('#ui-profile-posts').css('display', 'none');
    $('#ui-profile-edit').css('display', 'none');
}

function prepareProfile() {
    setBodyClass('page-profile');
    changeBoxFilter('#ui-profile-filter');
    changeSidebar('#profile-sidebar');
    changeUIBodyClass('profile', true);
    changeFollowingContainerClasses(['col-md-3', 'col-lg-2'], false);
    changeFollowingContainerClasses(['col-md-2'], true);
    $('#main-content').css('display', 'none');
}

function showExploreView(filter  = '#ui-main-filter-discover') {
    prepareMain();
    setActiveBoxFilter(filter);
    changeBoxFilter('#ui-main-filter');
    changeBodyContent('#ui-posts');
    return false;
}

function showWalletView(filter = '#ui-wallet-filter-overview', tabpanel = 'overview') {
    prepareMain();
    setBodyClass('page-wallet');
    changeBoxFilter('#ui-wallet-filter');
    setActiveBoxFilter(filter);
    setLastTabPanel('#' + tabpanel);
    changeBodyContent('#ui-wallet');
    return false;
}

function showSettings() {
    prepareMain();
    setBodyClass('page-profile edit-profile');
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