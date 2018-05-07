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
        lastBodyContent.addClass('hidden')
    }

    lastBodyContent = $(newId);
    lastBodyContent.removeClass('hidden')
}

function changeSidebar(newId) {
    if (lastSidebar) {
        lastSidebar.addClass('hidden')
    }

    lastSidebar = $(newId);
    lastSidebar.removeClass('hidden')
}

function changeBoxFilter(newId) {
    if (lastBoxFilter) {
        lastBoxFilter.addClass('hidden');
    }

    lastBoxFilter = $(newId);
    lastBoxFilter.removeClass('hidden')
}

function changeProfileContent(newId) {
    if (lastProfileContent) {
        lastProfileContent.addClass('hidden')
    }

    lastProfileContent = $(newId);
    lastProfileContent.removeClass('hidden')
}

function prepareMain() {
    setBodyClass('page-dashboard');
    changeSidebar('#main-sidebar');
    changeUIBodyClass('profile', false);
    changeFollowingContainerClasses(['col-md-2'], false);
    changeFollowingContainerClasses(['col-md-3', 'col-lg-2'], true);
    $('#main-content').removeClass('hidden');
    $('#ui-profile-posts').addClass('hidden');
    $('#ui-profile-edit').addClass('hidden');
}

function prepareProfile() {
    setBodyClass('page-profile');
    changeBoxFilter('#ui-profile-filter');
    changeSidebar('#profile-sidebar');
    changeUIBodyClass('profile', true);
    changeFollowingContainerClasses(['col-md-3', 'col-lg-2'], false);
    changeFollowingContainerClasses(['col-md-2'], true);
    $('#main-content').addClass('hidden');
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

function showSettingsView() {
    prepareMain();
    setBodyClass('page-profile edit-profile');
    changeBoxFilter('#ui-main-filter');
    changeBodyContent('#ui-settings');
    return false;
}

function showProfileView(profileContent = '#ui-profile-posts', profileActiveFilter = '#ui-profile-filter-projects') {
    prepareProfile();
    changeProfileContent(profileContent);
    setActiveBoxFilter(profileActiveFilter);
    return false;
}

function showProfileEditView() {
    prepareProfile();
    setBodyClass('page-profile edit-profile');
    changeProfileContent('#ui-profile-edit');
    return false;
}

function showNotificationsView() {
    //$('#notifications-num').html(0);
    trantor.dbrunner.setViewedNotifications();
    loadTopNotifications();
    prepareProfile();
    setBodyClass('page-profile edit-profile');
    setActiveBoxFilter('#ui-profile-filter-notifications');
    changeProfileContent('#ui-user-notifications');
    return false;
}

function showAboutModal() {
    $('#modal-about').modal('show');
    return false;
}

function showModalArticle() {
    $('#modal-article').modal({ show: false});

    setTimeout(function () {
        $('#modal-article').modal('show');
    }, 200);
}

function closeModalArticle() {
    $('#modal-article').modal('hide');
}

showExploreView();