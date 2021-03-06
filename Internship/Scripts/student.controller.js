﻿angular.module("mainModule").controller("studentController", ["$scope", "$state", "userService", function ($scope, $state, userService) {
    
    // If userService is not loaded, redirect to home state
    if (!userService.userLoaded) {
        $state.transitionTo("home");
    }

    // Two companies assigned for the user and the cv upload status
    $scope.company = ["", ""];
    $scope.companyStatus = ["Loading", "Loading"];
    $scope.updating = false;

    var clientContext = SP.ClientContext.get_current();
    var appWebUrl = userService.appWebUrl;
    var hostWebUrl = userService.hostWebUrl;

    // Get the compnay details for the user
    var userEmail = userService.userEmail;
    
    // handle this when name contains dots
    $scope.link1 = userService.hostWebUrl + '/InternshipList/' + userEmail.split('.')[0] + userEmail.split('.')[1].split('@')[0] + '0.pdf';
    $scope.link2 = userService.hostWebUrl + '/InternshipList/' + userEmail.split('.')[0] + userEmail.split('.')[1].split('@')[0] + '1.pdf';

    var companyList = clientContext.get_web().get_lists().getByTitle("StudentList");
    var camlQuery = new SP.CamlQuery();
    camlQuery.set_viewXml("<View><Query><Where><Eq><FieldRef Name='Email' /><Value Type='Text'>" + userEmail + "</Value></Eq></Where></Query></View>");
    var items = companyList.getItems(camlQuery);

    clientContext.load(items);
    clientContext.executeQueryAsync(function () {
        var enumerator = items.getEnumerator();
        
        // There can be only one entry
        if (enumerator.moveNext()) {
            $scope.company[0] = enumerator.get_current().get_item("Company1");
            $scope.company[1] = enumerator.get_current().get_item("Company2");
        }

        // After retriving companies search whether CV uploaded.
        getCompanyStatus();

        // Since this is callback method, call $apply to apply changes to the view
        $scope.$apply();

    }, onError);

    // get the status (that is whether a CV for that company is uploaded or not)
    function getCompanyStatus() {
        var hostClientContext = new SP.AppContextSite(clientContext, hostWebUrl);
        var internshipList = hostClientContext.get_web().get_lists().getByTitle("InternshipList");

        var camlQuery = new SP.CamlQuery();
        camlQuery.set_viewXml("<View><Query><Where><Eq><FieldRef Name='Email' /><Value Type='Text'>" + userEmail + "</Value></Eq></Where></Query></View>");
        items = internshipList.getItems(camlQuery);

        clientContext.load(items);
        clientContext.executeQueryAsync(function () {
            var enumerator = items.getEnumerator();

            $scope.companyStatus[0] = "Not Uploaded";
            $scope.companyStatus[1] = "Not Uploaded";

            while (enumerator.moveNext()) {
                var tempCompany = enumerator.get_current().get_item("Company");

                if (tempCompany == $scope.company[0]) {
                    $scope.companyStatus[0] = "CV Uploaded";
                }
                else if (tempCompany == $scope.company[1]) {
                    $scope.companyStatus[1] = "CV Uploaded";
                }
            }

            // Since this is a callback, $apply to appear changes in the view
            $scope.$apply();

        }, onError)


    }
    $scope.submitCV = function (id) {

        // check the file extension
        // if the file name contains dots, handle it
        temp = $('#getFile' + id).val().split('.').length
        if ($('#getFile' + id).val().split('.')[temp - 1] != 'pdf') {
            $("#modalHeader").html("File Type Error");
            $("#modalBody").html("Only PDFs are allowed to upload.");
            $("#dialogModal").modal();
            return;
        }

        $scope.updating = true;

        var hostClientContext = new SP.AppContextSite(clientContext, hostWebUrl);
        var internshipList = hostClientContext.get_web().get_lists().getByTitle("InternshipList");

        var camlQuery = new SP.CamlQuery();
        camlQuery.set_viewXml("<View><Query><Where><And><Eq><FieldRef Name='Email' /><Value Type='Text'>" + userEmail + "</Value></Eq><Eq><FieldRef Name='Company' /><Value Type='Text'>" + $scope.company[id] + "</Value></Eq></And></Where></Query></View>");
        items = internshipList.getItems(camlQuery);

        clientContext.load(items);
        clientContext.executeQueryAsync(function () {
            var enumerator = items.getEnumerator();

            // There can be only one matching entry
            if (enumerator.moveNext()) {
                enumerator.get_current().deleteObject();
                clientContext.executeQueryAsync(function () { uploadFile(id) }, onError);
            } else {
                // If no previous update is done
                uploadFile(id);
            }

            function uploadFile(id) {
                // Define the folder path
                var serverRelativeUrlToFolder = "InternshipList";

                // Get test values from the file input and text input page controls.
                // The display name must be unique every time you run the example.
                var fileInput = $('#getFile' + id);
                var newName = userEmail.split(".")[0] + userEmail.split(".")[1].split("@")[0] + id;

                // Initiate method calls using jQuery promises.
                // Get the local file as an array buffer.
                var getFile = getFileBuffer();
                getFile.done(function (arrayBuffer) {

                    // Add the file to the SharePoint folder.
                    var addFile = addFileToFolder(arrayBuffer);
                    addFile.done(function (file, status, xhr) {
                        // Get the list item that corresponds to the uploaded file.
                        var getItem = getListItem(file.d.ListItemAllFields.__deferred.uri);
                        getItem.done(function (listItem, status, xhr) {

                            // Change the display name and title of the list item.
                            var changeItem = updateListItem(listItem.d.__metadata);
                            changeItem.done(function (data, status, xhr) {
                                $("#modalHeader").html("Successfully Updated");
                                $("#modalBody").html("The CV has been uploaded successfully. Please double check using the Download CV button.");
                                $("#dialogModal").modal();

                                $scope.updating = false;
                                $scope.$apply();

                                // Change the upload status
                                getCompanyStatus();
                                

                            });
                            changeItem.fail(onError);
                        });
                        getItem.fail(onError);
                    });
                    addFile.fail(onError);
                });
                getFile.fail(onError);

                // Get the local file as an array buffer.
                function getFileBuffer() {
                    var deferred = $.Deferred();
                    var reader = new FileReader();
                    reader.onloadend = function (e) {
                        deferred.resolve(e.target.result);
                    }
                    reader.onerror = function (e) {
                        deferred.reject(e.target.error);
                    }
                    reader.readAsArrayBuffer(fileInput[0].files[0]);
                    return deferred.promise();
                }

                // Add the file to the file collection in the Shared Documents folder.
                function addFileToFolder(arrayBuffer) {

                    // Get the file name from the file input control on the page.
                    var parts = fileInput[0].value.split('\\');
                    var fileName = parts[parts.length - 1].split(".")[0] + id +"."+ parts[parts.length - 1].split(".")[1];

                    // Construct the endpoint.
                    var fileCollectionEndpoint = String.format(
                        "{0}/_api/sp.appcontextsite(@target)/web/getfolderbyserverrelativeurl('{1}')/files" +
                        "/add(overwrite=true, url='{2}')?@target='{3}'",
                        appWebUrl, serverRelativeUrlToFolder, fileName, hostWebUrl);

                    // Send the request and return the response.
                    // This call returns the SharePoint file.
                    return $.ajax({
                        url: fileCollectionEndpoint,
                        type: "POST",
                        data: arrayBuffer,
                        processData: false,
                        headers: {
                            "accept": "application/json;odata=verbose",
                            "X-RequestDigest": $("#__REQUESTDIGEST").val(),
                            //"content-length": arrayBuffer.byteLength
                        }
                    });
                }

                // Get the list item that corresponds to the file by calling the file's ListItemAllFields property.
                function getListItem(fileListItemUri) {

                    // Construct the endpoint.
                    // The list item URI uses the host web, but the cross-domain call is sent to the
                    // add-in web and specifies the host web as the context site.
                    fileListItemUri = fileListItemUri.replace(hostWebUrl, '{0}');
                    fileListItemUri = fileListItemUri.replace('_api/Web', '_api/sp.appcontextsite(@target)/web');

                    var listItemAllFieldsEndpoint = String.format(fileListItemUri + "?@target='{1}'",
                        appWebUrl, hostWebUrl);

                    // Send the request and return the response.
                    return $.ajax({
                        url: listItemAllFieldsEndpoint,
                        type: "GET",
                        headers: { "accept": "application/json;odata=verbose" }
                    });
                }

                // Change the display name and title of the list item.
                function updateListItem(itemMetadata) {

                    // Construct the endpoint.
                    // Specify the host web as the context site.
                    var listItemUri = itemMetadata.uri.replace('_api/Web', '_api/sp.appcontextsite(@target)/web');
                    var listItemEndpoint = String.format(listItemUri + "?@target='{0}'", hostWebUrl);

                    // Define the list item changes. Use the FileLeafRef property to change the display name.
                    // For simplicity, also use the name as the title.
                    // The example gets the list item type from the item's metadata, but you can also get it from the
                    // ListItemEntityTypeFullName property of the list.

                    var body = String.format("{{'__metadata':{{'type':'{0}'}},'FileLeafRef':'{1}','Title':'{2}','Email':'{3}','Company':'{4}'}}",
                        itemMetadata.type, newName, newName, userEmail, $scope.company[id]);

                    // Send the request and return the promise.
                    // This call does not return response content from the server.
                    return $.ajax({
                        url: listItemEndpoint,
                        type: "POST",
                        data: body,
                        headers: {
                            "X-RequestDigest": $("#__REQUESTDIGEST").val(),
                            "content-type": "application/json;odata=verbose",
                            //"content-length": body.length,
                            "IF-MATCH": itemMetadata.etag,
                            "X-HTTP-Method": "MERGE",
                            "If-Match": "*"
                        }
                    });
                }
            }

        }
        
        , onError);

    }

    


    function onError(err) {
        console.log(err);
        $("#modalHeader").html("An Error Occurred");
        $("#modalBody").html("Something went wrong. This is most probably due to bad internet connection. Please perform the task again.");
        $("#dialogModal").modal();

        $scope.updating = false;
        $scope.$apply();
    }


}]);
