import json
import os
import shutil
import sys
import tempfile
import traceback

from girder.constants import AccessType
from girder.utility import config
from girder.utility.model_importer import ModelImporter
from girder.plugins.jobs.constants import JobStatus
from girder.plugins.minerva.utility.bsve import bsve_utility
from girder.plugins.minerva.utility.dataset_utility import \
    jsonArrayHead, GeoJsonMapper, jsonObjectReader
from girder.plugins.minerva.utility.minerva_utility import mM

import girder_client

config_file = os.path.join(
    os.path.dirname(bsve_utility.__file__), 'bsve.json'
)


def run(job):
    job_model = ModelImporter.model('job', 'jobs')
    job_model.updateJob(job, status=JobStatus.RUNNING)

    try:
        with open(config_file, 'r') as f:
            bsve_config = json.loads(f.read())

        kwargs = job['kwargs']
        bsveSearchParams = kwargs['params']['bsveSearchParams']
        datasetId = str(kwargs['dataset']['_id'])
        # TODO better to create a job token rather than a user token?
        token = kwargs['token']

        bsveUtility = bsve_utility.BsveUtility(
            bsve_config['bsve']['USER_NAME'],
            bsve_config['bsve']['API_KEY'],
            bsve_config['bsve']['SECRET_KEY']
        )

        # TODO sleeping in async thread, probably starving other tasks
        # would be better to split this into two or more parts, creating
        # additional jobs as needed
        searchResult = bsveUtility.search(bsveSearchParams)

        # write the output to a json file
        tmpdir = tempfile.mkdtemp()
        outFilepath = tempfile.mkstemp(suffix='.json', dir=tmpdir)[1]
        writer = open(outFilepath, 'w')
        writer.write(json.dumps(searchResult))
        writer.close()

        # rename the file so it will have the right name when uploaded
        # could probably be done post upload
        outFilename = 'search.json'
        humanFilepath = os.path.join(tmpdir, outFilename)
        shutil.move(outFilepath, humanFilepath)

        # connect to girder and upload the file
        # TODO will probably have to change this from local to romanesco
        # so that can work on worker machine
        # at least need host connection info
        girderPort = config.getConfig()['server.socket_port']
        client = girder_client.GirderClient(port=girderPort)
        client.token = token['_id']

        client.uploadFileToItem(datasetId, humanFilepath)

        # TODO some stuff here using models will only work on a local job
        # will have to be rewritten using girder client to work in romanesco
        # non-locally

        user_model = ModelImporter.model('user')
        user = user_model.load(job['userId'], force=True)
        item_model = ModelImporter.model('item')

        dataset = item_model.load(datasetId, level=AccessType.WRITE, user=user)
        minerva_metadata = mM(dataset)

        file_model = ModelImporter.model('file')
        existing = file_model.findOne({
            'itemId': dataset['_id'],
            'name': outFilename
        })
        if existing:
            minerva_metadata['original_files'] = [{
                '_id': existing['_id'],
                'name': outFilename
            }]
        else:
            raise (Exception('Cannot find file %s in dataset %s' %
                   (outFilename, datasetId)))

        jsonRow = jsonArrayHead(humanFilepath, limit=1)[0]
        minerva_metadata['json_row'] = jsonRow

        # Generate the geojson for this dataset and set
        # dataset_type = geojson

        geojsonFilename = 'search.geojson'
        geojsonFilepath = os.path.join(tmpdir, geojsonFilename)

        mapping = {
            "dateKeypath": "",
            "latitudeKeypath": "data.Latitude",
            "longitudeKeypath": "data.Longitude"
        }

        geojsonMapper = GeoJsonMapper(objConverter=None, mapping=mapping)
        objects = jsonObjectReader(humanFilepath)
        geojsonMapper.mapToJsonFile(tmpdir, objects, geojsonFilepath)

        client.uploadFileToItem(datasetId, geojsonFilepath)
        shutil.rmtree(tmpdir)

        minerva_metadata['mapper'] = mapping
        minerva_metadata['dataset_type'] = 'geojson'

        existing = file_model.findOne({
            'itemId': dataset['_id'],
            'name': geojsonFilename
        })
        if existing:
            minerva_metadata['geojson_file'] = {
                '_id': existing['_id'],
                'name': geojsonFilename
            }
        else:
            raise (Exception('Cannot find file %s in dataset %s' %
                   (geojsonFilename, datasetId)))

        mM(dataset, minerva_metadata)
        job_model.updateJob(job, status=JobStatus.SUCCESS)
    except Exception:
        t, val, tb = sys.exc_info()
        log = '%s: %s\n%s' % (t.__name__, repr(val), traceback.extract_tb(tb))
        # TODO only works locally
        job_model.updateJob(job, status=JobStatus.ERROR, log=log)
        raise
