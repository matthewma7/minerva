#!/usr/bin/env python
# -*- coding: utf-8 -*-

###############################################################################
#  Copyright Kitware Inc.
#
#  Licensed under the Apache License, Version 2.0 ( the "License" );
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
###############################################################################


from girder.models.notification import ProgressState


# Constants representing the setting keys for this plugin
class JobStatus(object):
    INACTIVE = 0
    QUEUED = 1
    RUNNING = 2
    SUCCESS = 3
    ERROR = 4
    CANCELED = 5

    @staticmethod
    def isValid(status):
        return status in (JobStatus.INACTIVE, JobStatus.QUEUED,
                          JobStatus.RUNNING, JobStatus.SUCCESS, JobStatus.ERROR,
                          JobStatus.CANCELED)

    @staticmethod
    def toNotificationStatus(status):
        if status in (JobStatus.INACTIVE, JobStatus.QUEUED):
            return ProgressState.QUEUED
        if status == JobStatus.RUNNING:
            return ProgressState.ACTIVE
        if status == JobStatus.SUCCESS:
            return ProgressState.SUCCESS
        else:
            return ProgressState.ERROR