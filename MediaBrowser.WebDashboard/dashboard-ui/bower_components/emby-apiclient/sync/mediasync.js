define(["localassetmanager"],function(localassetmanager){"use strict";function processDownloadStatus(apiClient,serverInfo,options){return console.log("[mediasync] Begin processDownloadStatus"),localassetmanager.resyncTransfers().then(function(){return localassetmanager.getServerItems(serverInfo.Id).then(function(items){console.log("[mediasync] Begin processDownloadStatus getServerItems completed");var p=Promise.resolve(),cnt=0,progressItems=items.filter(function(item){return"transferring"===item.SyncStatus||"queued"===item.SyncStatus});return progressItems.forEach(function(item){p=p.then(function(){return reportTransfer(apiClient,item)}),cnt++}),p.then(function(){return console.log("[mediasync] Exit processDownloadStatus. Items reported: "+cnt.toString()),Promise.resolve()})})})}function reportTransfer(apiClient,item){return localassetmanager.getItemFileSize(item.LocalPath).then(function(size){return size>0?apiClient.reportSyncJobItemTransferred(item.SyncJobItemId).then(function(){return item.SyncStatus="synced",localassetmanager.addOrUpdateLocalItem(item)},function(error){return console.error("[mediasync] Mediasync error on reportSyncJobItemTransferred",error),item.SyncStatus="error",localassetmanager.addOrUpdateLocalItem(item)}):localassetmanager.isDownloadFileInQueue(item.LocalPath).then(function(result){return result?Promise.resolve():(console.log("[mediasync] reportTransfer: Size is 0 and download no longer in queue. Deleting item."),localassetmanager.removeLocalItem(item).then(function(){return console.log("[mediasync] reportTransfer: Item deleted."),Promise.resolve()},function(err2){return console.log("[mediasync] reportTransfer: Failed to delete item.",err2),Promise.resolve()}))})},function(error){return console.error("[mediasync] reportTransfer: error on getItemFileSize. Deleting item.",error),localassetmanager.removeLocalItem(item).then(function(){return console.log("[mediasync] reportTransfer: Item deleted."),Promise.resolve()},function(err2){return console.log("[mediasync] reportTransfer: Failed to delete item.",error),Promise.resolve()})})}function reportOfflineActions(apiClient,serverInfo){return console.log("[mediasync] Begin reportOfflineActions"),localassetmanager.getUserActions(serverInfo.Id).then(function(actions){return actions.length?apiClient.reportOfflineActions(actions).then(function(){return localassetmanager.deleteUserActions(actions).then(function(){return console.log("[mediasync] Exit reportOfflineActions (actions reported and deleted.)"),Promise.resolve()})},function(err){return console.error("[mediasync] error on apiClient.reportOfflineActions: "+err.toString()),localassetmanager.deleteUserActions(actions)}):(console.log("[mediasync] Exit reportOfflineActions (no actions)"),Promise.resolve())})}function syncData(apiClient,serverInfo,syncUserItemAccess){return console.log("[mediasync] Begin syncData"),localassetmanager.getServerItems(serverInfo.Id).then(function(items){var completedItems=items.filter(function(item){return item&&("synced"===item.SyncStatus||"error"===item.SyncStatus)}),request={TargetId:apiClient.deviceId(),LocalItemIds:completedItems.map(function(xitem){return xitem.ItemId}),OfflineUserIds:(serverInfo.Users||[]).map(function(u){return u.Id})};return apiClient.syncData(request).then(function(result){return afterSyncData(apiClient,serverInfo,syncUserItemAccess,result).then(function(){return console.log("[mediasync] Exit syncData"),Promise.resolve()},function(err){return console.error("[mediasync] Error in syncData: "+err.toString()),Promise.resolve()})})})}function afterSyncData(apiClient,serverInfo,enableSyncUserItemAccess,syncDataResult){console.log("[mediasync] Begin afterSyncData");var p=Promise.resolve();return syncDataResult.ItemIdsToRemove&&syncDataResult.ItemIdsToRemove.length>0&&syncDataResult.ItemIdsToRemove.forEach(function(itemId){p=p.then(function(){return removeLocalItem(itemId,serverInfo.Id)})}),enableSyncUserItemAccess&&(p=p.then(function(){return syncUserItemAccess(syncDataResult,serverInfo.Id)})),p=p.then(function(){return removeObsoleteContainerItems(serverInfo.Id)}),p.then(function(){return console.log("[mediasync] Exit afterSyncData"),Promise.resolve()})}function removeObsoleteContainerItems(serverId){return console.log("[mediasync] Begin removeObsoleteContainerItems"),localassetmanager.removeObsoleteContainerItems(serverId)}function removeLocalItem(itemId,serverId){return console.log("[mediasync] Begin removeLocalItem"),localassetmanager.getLocalItem(serverId,itemId).then(function(item){return item?localassetmanager.removeLocalItem(item):Promise.resolve()})}function getNewMedia(apiClient,serverInfo,options,downloadCount){return console.log("[mediasync] Begin getNewMedia"),apiClient.getReadySyncItems(apiClient.deviceId()).then(function(jobItems){var p=Promise.resolve(),maxDownloads=10,currentCount=downloadCount;return jobItems.forEach(function(jobItem){currentCount++<=maxDownloads&&(p=p.then(function(){return getNewItem(jobItem,apiClient,serverInfo,options)}))}),p.then(function(){return console.log("[mediasync] Exit getNewMedia"),Promise.resolve()})})}function getNewItem(jobItem,apiClient,serverInfo,options){console.log("[mediasync] Begin getNewItem");var libraryItem=jobItem.Item;return localassetmanager.getLocalItem(serverInfo.Id,libraryItem.Id).then(function(existingItem){return!existingItem||"queued"!==existingItem.SyncStatus&&"transferring"!==existingItem.SyncStatus&&"synced"!==existingItem.SyncStatus?(libraryItem.CanDelete=!1,libraryItem.CanDownload=!1,libraryItem.SupportsSync=!1,libraryItem.People=[],libraryItem.Chapters=[],libraryItem.Studios=[],libraryItem.UserData={},libraryItem.SpecialFeatureCount=null,libraryItem.LocalTrailerCount=null,libraryItem.RemoteTrailers=[],localassetmanager.createLocalItem(libraryItem,serverInfo,jobItem).then(function(localItem){return console.log("[mediasync] getNewItem: createLocalItem completed"),localItem.SyncStatus="queued",downloadParentItems(apiClient,jobItem,localItem,serverInfo,options).then(function(){return downloadMedia(apiClient,jobItem,localItem,options).then(function(){return getImages(apiClient,jobItem,localItem).then(function(){return getSubtitles(apiClient,jobItem,localItem)})})})})):(console.log("[mediasync] getNewItem: getLocalItem found existing item"),Promise.resolve())})}function downloadParentItems(apiClient,jobItem,localItem,serverInfo,options){var p=Promise.resolve(),libraryItem=localItem.Item,itemType=(libraryItem.Type||"").toLowerCase();(libraryItem.ImageTags||{}).Logo;switch(itemType){case"episode":libraryItem.SeriesId&&(p=p.then(function(){return downloadItem(apiClient,libraryItem,libraryItem.SeriesId,serverInfo).then(function(seriesItem){return libraryItem.SeriesLogoImageTag=(seriesItem.Item.ImageTags||{}).Logo,Promise.resolve()})})),libraryItem.SeasonId&&(p=p.then(function(){return downloadItem(apiClient,libraryItem,libraryItem.SeasonId,serverInfo).then(function(seasonItem){return libraryItem.SeasonPrimaryImageTag=(seasonItem.Item.ImageTags||{}).Primary,Promise.resolve()})}));break;case"audio":case"photo":libraryItem.AlbumId&&(p=p.then(function(){return downloadItem(apiClient,libraryItem,libraryItem.AlbumId,serverInfo)}));break;case"video":case"movie":case"musicvideo":}return p}function downloadItem(apiClient,libraryItem,itemId,serverInfo){return apiClient.getItem(apiClient.getCurrentUserId(),itemId).then(function(downloadedItem){return downloadedItem.CanDelete=!1,downloadedItem.CanDownload=!1,downloadedItem.SupportsSync=!1,downloadedItem.People=[],downloadedItem.UserData={},downloadedItem.SpecialFeatureCount=null,downloadedItem.BackdropImageTags=null,localassetmanager.createLocalItem(downloadedItem,serverInfo,null).then(function(localItem){return localassetmanager.addOrUpdateLocalItem(localItem).then(function(){return Promise.resolve(localItem)})})},function(err){return console.error("[mediasync] downloadItem failed: "+err.toString()),Promise.resolve(null)})}function downloadMedia(apiClient,jobItem,localItem,options){var url=apiClient.getUrl("Sync/JobItems/"+jobItem.SyncJobItemId+"/File",{api_key:apiClient.accessToken()}),localPath=localItem.LocalPath;return console.log("[mediasync] Downloading media. Url: "+url+". Local path: "+localPath),options=options||{},localassetmanager.downloadFile(url,localItem).then(function(filename){return localItem.SyncStatus="transferring",localassetmanager.addOrUpdateLocalItem(localItem)})}function getImages(apiClient,jobItem,localItem){console.log("[mediasync] Begin getImages");var p=Promise.resolve(),libraryItem=localItem.Item,serverId=libraryItem.ServerId,mainImageTag=(libraryItem.ImageTags||{}).Primary;libraryItem.Id&&mainImageTag&&(p=p.then(function(){return downloadImage(localItem,apiClient,serverId,libraryItem.Id,mainImageTag,"Primary")}));var logoImageTag=(libraryItem.ImageTags||{}).Logo;libraryItem.Id&&logoImageTag&&(p=p.then(function(){return downloadImage(localItem,apiClient,serverId,libraryItem.Id,logoImageTag,"Logo")}));var artImageTag=(libraryItem.ImageTags||{}).Art;libraryItem.Id&&artImageTag&&(p=p.then(function(){return downloadImage(localItem,apiClient,serverId,libraryItem.Id,artImageTag,"Art")}));var bannerImageTag=(libraryItem.ImageTags||{}).Banner;libraryItem.Id&&bannerImageTag&&(p=p.then(function(){return downloadImage(localItem,apiClient,serverId,libraryItem.Id,bannerImageTag,"Banner")}));var thumbImageTag=(libraryItem.ImageTags||{}).Thumb;if(libraryItem.Id&&thumbImageTag&&(p=p.then(function(){return downloadImage(localItem,apiClient,serverId,libraryItem.Id,thumbImageTag,"Thumb")})),libraryItem.Id&&libraryItem.BackdropImageTags)for(var i=0;i<libraryItem.BackdropImageTags.length;i++);return libraryItem.SeriesId&&libraryItem.SeriesPrimaryImageTag&&(p=p.then(function(){return downloadImage(localItem,apiClient,serverId,libraryItem.SeriesId,libraryItem.SeriesPrimaryImageTag,"Primary")})),libraryItem.SeriesId&&libraryItem.SeriesThumbImageTag&&(p=p.then(function(){return downloadImage(localItem,apiClient,serverId,libraryItem.SeriesId,libraryItem.SeriesThumbImageTag,"Thumb")})),libraryItem.SeriesId&&libraryItem.SeriesLogoImageTag&&(p=p.then(function(){return downloadImage(localItem,apiClient,serverId,libraryItem.SeriesId,libraryItem.SeriesLogoImageTag,"Logo")})),libraryItem.SeasonId&&libraryItem.SeasonPrimaryImageTag&&(p=p.then(function(){return downloadImage(localItem,apiClient,serverId,libraryItem.SeasonId,libraryItem.SeasonPrimaryImageTag,"Primary")})),libraryItem.AlbumId&&libraryItem.AlbumPrimaryImageTag&&(p=p.then(function(){return downloadImage(localItem,apiClient,serverId,libraryItem.AlbumId,libraryItem.AlbumPrimaryImageTag,"Primary")})),p.then(function(){return console.log("[mediasync] Finished getImages"),localassetmanager.addOrUpdateLocalItem(localItem)},function(err){return console.log("[mediasync] Error getImages: "+err.toString()),Promise.resolve()})}function downloadImage(localItem,apiClient,serverId,itemId,imageTag,imageType,index){return index=index||0,localassetmanager.hasImage(serverId,itemId,imageType,index).then(function(hasImage){if(hasImage)return console.log("[mediasync] downloadImage - skip existing: "+itemId+" "+imageType+"_"+index.toString()),Promise.resolve();var maxWidth=400;"backdrop"===imageType&&(maxWidth=null);var imageUrl=apiClient.getScaledImageUrl(itemId,{tag:imageTag,type:imageType,maxWidth:maxWidth,api_key:apiClient.accessToken()});return console.log("[mediasync] downloadImage "+itemId+" "+imageType+"_"+index.toString()),localassetmanager.downloadImage(localItem,imageUrl,serverId,itemId,imageType,index).then(function(result){return Promise.resolve()},function(err){return console.log("[mediasync] Error downloadImage: "+err.toString()),Promise.resolve()})},function(err){return console.log("[mediasync] Error downloadImage: "+err.toString()),Promise.resolve()})}function getSubtitles(apiClient,jobItem,localItem){if(console.log("[mediasync] Begin getSubtitles"),!jobItem.Item.MediaSources.length)return console.log("[mediasync] Cannot download subtitles because video has no media source info."),Promise.resolve();var files=jobItem.AdditionalFiles.filter(function(f){return"Subtitles"===f.Type}),mediaSource=jobItem.Item.MediaSources[0],p=Promise.resolve();return files.forEach(function(file){p=p.then(function(){return getItemSubtitle(file,apiClient,jobItem,localItem,mediaSource)})}),p.then(function(){return console.log("[mediasync] Exit getSubtitles"),Promise.resolve()})}function getItemSubtitle(file,apiClient,jobItem,localItem,mediaSource){console.log("[mediasync] Begin getItemSubtitle");var subtitleStream=mediaSource.MediaStreams.filter(function(m){return"Subtitle"===m.Type&&m.Index===file.Index})[0];if(!subtitleStream)return console.log("[mediasync] Cannot download subtitles because matching stream info was not found."),Promise.resolve();var url=apiClient.getUrl("Sync/JobItems/"+jobItem.SyncJobItemId+"/AdditionalFiles",{Name:file.Name,api_key:apiClient.accessToken()}),fileName=localassetmanager.getSubtitleSaveFileName(localItem,jobItem.OriginalFileName,subtitleStream.Language,subtitleStream.IsForced,subtitleStream.Codec);return localassetmanager.downloadSubtitles(url,fileName).then(function(subtitlePath){return localItem.AdditionalFiles&&localItem.AdditionalFiles.forEach(function(item){item.Name===file.Name&&(item.Path=subtitlePath)}),subtitleStream.Path=subtitlePath,localassetmanager.addOrUpdateLocalItem(localItem)})}return function(){var self=this;self.sync=function(apiClient,serverInfo,options){return console.log("[mediasync]************************************* Start sync"),processDownloadStatus(apiClient,serverInfo,options).then(function(){return localassetmanager.getDownloadItemCount().then(function(downloadCount){return options.syncCheckProgressOnly===!0&&downloadCount>2?Promise.resolve():reportOfflineActions(apiClient,serverInfo).then(function(){return getNewMedia(apiClient,serverInfo,options,downloadCount).then(function(){return syncData(apiClient,serverInfo,!1).then(function(){return console.log("[mediasync]************************************* Exit sync"),Promise.resolve()})})})})},function(err){console.error(err.toString())})}}});