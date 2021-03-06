﻿angular.module("mainModule").controller("adminController", ["$scope",'$state','userService', function ($scope, $state, userService) {

    // Front-end security
    // If user not loaded, go to the home state
    if (!userService.userLoaded) {
        $state.go('home');
    }

    // IF the current user type is not admin, go again to the home state
    if (!userService.getUserType() == 'Admin') {
        $state.go('home');
    }

    $scope.studentArray;
    $scope.csvLoaded = false;
    $scope.updating = false;

    $scope.readFile = function () {
        // Check file extention
        var fileExt = document.getElementById("studentCompanyList").value;
        fileExt = fileExt.split(".");
        fileExt = fileExt[fileExt.length - 1];

        if (fileExt !== "csv") {
            $("#modalHeader").html("File type error");
            $("#modalBody").html("Only CSV files are allowed. Please upload a .CSV file.");
            $("#dialogModal").modal();
            return;
        }
        

        var files = document.getElementById("studentCompanyList").files;

        if (!files.length) {
            $("#modalHeader").html("No File Found");
            $("#modalBody").html("Please upload a file. (.CSV)");
            $("#dialogModal").modal();
            return;
        }

        var file = files[0];

        var reader = new FileReader();

        reader.onloadend = function (evt) {
            if (evt.target.readyState == FileReader.DONE) {
                $scope.studentArray = Papa.parse(evt.target.result).data;
                
                // Remove the first row; (Header row)
                $scope.studentArray = $scope.studentArray.slice(1);
                $scope.csvLoaded = true;

                // Apply changes to $scope since this is called from a callback
                $scope.$apply();

                // Load as a datatable
                $("#tempTable").DataTable();

            }
        };

        reader.readAsText(file);

    }

    $scope.updateToDatabase = function () {

        if (!$scope.csvLoaded) {
            return;
        }

        $scope.updating = true;

        // Delete all the current records
        var clientContext = SP.ClientContext.get_current();
        var studentList = clientContext.get_web().get_lists().getByTitle("StudentList");
        var camlQuery = new SP.CamlQuery();
        var items = studentList.getItems(camlQuery);

        clientContext.load(items, "Include(Id)");

        clientContext.executeQueryAsync(function () {
            var enumerator = items.getEnumerator();
            var tempArray = [];
            while (enumerator.moveNext()) {
                tempArray.push(enumerator.get_current());
            }

            for (var i in tempArray) {
                tempArray[i].deleteObject();
            }

            // Now execute the delete operation and perform the add operation
            clientContext.executeQueryAsync(function () {
                // Add every element in the $scope.studentArray
                for (var i = 0; i < $scope.studentArray.length - 1 ; i++) {
                    var itemCreationInfo = new SP.ListItemCreationInformation();
                    var newItem = studentList.addItem(itemCreationInfo);
                    newItem.set_item("Email", $scope.studentArray[i][0]);
                    newItem.set_item("Company1", $scope.studentArray[i][1]);
                    newItem.set_item("Company2", $scope.studentArray[i][2]);
                    newItem.update();
                }

                clientContext.executeQueryAsync(function () {
                    $("#modalHeader").html("Operation Success");
                    $("#modalBody").html("Successfully loaded the data to the database. Click <b>View Current</b> button to recheck values stored in the database.");
                    $("#dialogModal").modal();

                    $scope.updating = false;
                    // Since an ASYNC call, call apply
                    $scope.$apply();

                }, onError)


            }, onError)
        },
        onError);

    }

    function onError(err) {
        console.log(err);
        $("#modalHeader").html("Error Occurred");
        $("#modalBody").html("There has been an error, this migth be becuase of an internet connection problem. Please try to perform the task again.");
        $("#dialogModal").modal();
        $scope.updating = false;
        $scope.$apply();
    }

}]);