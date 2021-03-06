define(["loading", "dialogHelper", "dom", "jQuery", "components/libraryoptionseditor/libraryoptionseditor", "emby-toggle", "emby-input", "emby-select", "paper-icon-button-light", "listViewStyle", "formDialogStyle", "emby-linkbutton", "flexStyles"], function(loading, dialogHelper, dom, $, libraryoptionseditor) {
    "use strict";

    function onSubmit(e) {
        if (e.preventDefault(), e.stopPropagation(), 0 == pathInfos.length) return require(["alert"], function(alert) {
            alert({
                text: Globalize.translate("PleaseAddAtLeastOneFolder"),
                type: "error"
            })
        }), !1;
        var form = this,
            dlg = $(form).parents(".dialog")[0],
            name = $("#txtValue", form).val(),
            type = $("#selectCollectionType", form).val();
        "mixed" == type && (type = null);
        var libraryOptions = libraryoptionseditor.getLibraryOptions(dlg.querySelector(".libraryOptions"));
        return libraryOptions.PathInfos = pathInfos, ApiClient.addVirtualFolder(name, type, currentOptions.refresh, libraryOptions).then(function() {
            hasChanges = !0, dialogHelper.close(dlg)
        }, function() {
            require(["toast"], function(toast) {
                toast(Globalize.translate("ErrorAddingMediaPathToVirtualFolder"))
            })
        }), !1
    }

    function getCollectionTypeOptionsHtml(collectionTypeOptions) {
        return collectionTypeOptions.filter(function(i) {
            return !1 !== i.isSelectable
        }).map(function(i) {
            return '<option value="' + i.value + '">' + i.name + "</option>"
        }).join("")
    }

    function initEditor(page, collectionTypeOptions) {
        $("#selectCollectionType", page).html(getCollectionTypeOptionsHtml(collectionTypeOptions)).val("").on("change", function() {
            var value = this.value,
                dlg = $(this).parents(".dialog")[0];
            if (libraryoptionseditor.setContentType(dlg.querySelector(".libraryOptions"), "mixed" == value ? "" : value), value ? dlg.querySelector(".libraryOptions").classList.remove("hide") : dlg.querySelector(".libraryOptions").classList.add("hide"), "mixed" != value) {
                var index = this.selectedIndex;
                if (-1 != index) {
                    var name = this.options[index].innerHTML.replace("*", "").replace("&amp;", "&");
                    $("#txtValue", dlg).val(name);
                    var folderOption = collectionTypeOptions.filter(function(i) {
                        return i.value == value
                    })[0];
                    $(".collectionTypeFieldDescription", dlg).html(folderOption.message || "")
                }
            }
        }), page.querySelector(".btnAddFolder").addEventListener("click", onAddButtonClick), page.querySelector("form").addEventListener("submit", onSubmit), page.querySelector(".folderList").addEventListener("click", onRemoveClick), page.querySelector(".chkAdvanced").addEventListener("change", onToggleAdvancedChange)
    }

    function onToggleAdvancedChange() {
        var dlg = dom.parentWithClass(this, "dlg-librarycreator");
        libraryoptionseditor.setAdvancedVisible(dlg.querySelector(".libraryOptions"), this.checked)
    }

    function onAddButtonClick() {
        var page = dom.parentWithClass(this, "dlg-librarycreator");
        require(["directorybrowser"], function(directoryBrowser) {
            var picker = new directoryBrowser;
            picker.show({
                enableNetworkSharePath: !0,
                callback: function(path, networkSharePath) {
                    path && addMediaLocation(page, path, networkSharePath), picker.close()
                }
            })
        })
    }

    function getFolderHtml(pathInfo, index) {
        var html = "";
        return html += '<div class="listItem listItem-border lnkPath" style="padding-left:.5em;">', html += '<div class="' + (pathInfo.NetworkPath ? "listItemBody two-line" : "listItemBody") + '">', html += '<div class="listItemBodyText">' + pathInfo.Path + "</div>", pathInfo.NetworkPath && (html += '<div class="listItemBodyText secondary">' + pathInfo.NetworkPath + "</div>"), html += "</div>", html += '<button type="button" is="paper-icon-button-light"" class="listItemButton btnRemovePath" data-index="' + index + '"><i class="md-icon">remove_circle</i></button>', html += "</div>"
    }

    function renderPaths(page) {
        var foldersHtml = pathInfos.map(getFolderHtml).join(""),
            folderList = page.querySelector(".folderList");
        folderList.innerHTML = foldersHtml, foldersHtml ? folderList.classList.remove("hide") : folderList.classList.add("hide")
    }

    function addMediaLocation(page, path, networkSharePath) {
        var pathLower = path.toLowerCase();
        if (0 == pathInfos.filter(function(p) {
                return p.Path.toLowerCase() == pathLower
            }).length) {
            var pathInfo = {
                Path: path
            };
            networkSharePath && (pathInfo.NetworkPath = networkSharePath), pathInfos.push(pathInfo), renderPaths(page)
        }
    }

    function onRemoveClick(e) {
        var button = dom.parentWithClass(e.target, "btnRemovePath"),
            index = parseInt(button.getAttribute("data-index")),
            location = pathInfos[index].Path,
            locationLower = location.toLowerCase();
        pathInfos = pathInfos.filter(function(p) {
            return p.Path.toLowerCase() != locationLower
        }), renderPaths(dom.parentWithClass(button, "dlg-librarycreator"))
    }

    function onDialogClosed() {
        loading.hide(), currentResolve(hasChanges)
    }

    function initLibraryOptions(dlg) {
        libraryoptionseditor.embed(dlg.querySelector(".libraryOptions")).then(function() {
            $("#selectCollectionType", dlg).trigger("change"), onToggleAdvancedChange.call(dlg.querySelector(".chkAdvanced"))
        })
    }

    function editor() {
        this.show = function(options) {
            return new Promise(function(resolve, reject) {
                currentOptions = options, currentResolve = resolve, hasChanges = !1;
                var xhr = new XMLHttpRequest;
                xhr.open("GET", "components/medialibrarycreator/medialibrarycreator.template.html", !0), xhr.onload = function(e) {
                    var template = this.response,
                        dlg = dialogHelper.createDialog({
                            size: "medium-tall",
                            modal: !1,
                            removeOnClose: !0,
                            scrollY: !1
                        });
                    dlg.classList.add("ui-body-a"), dlg.classList.add("background-theme-a"), dlg.classList.add("dlg-librarycreator"), dlg.classList.add("formDialog"), dlg.innerHTML = Globalize.translateDocument(template), initEditor(dlg, options.collectionTypeOptions), dlg.addEventListener("close", onDialogClosed), dialogHelper.open(dlg), dlg.querySelector(".btnCancel").addEventListener("click", function() {
                        dialogHelper.close(dlg)
                    }), pathInfos = [], renderPaths(dlg), initLibraryOptions(dlg)
                }, xhr.send()
            })
        }
    }
    var currentResolve, hasChanges, currentOptions, pathInfos = [];
    return editor
});